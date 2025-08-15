/**
 * LSP Process Manager and Communication Client
 * 
 * @module server/client
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { ChildProcess, spawn } from 'child_process';
import { readFileSync } from 'fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  createMessageConnection,
  MessageConnection,
  StreamMessageReader,
  StreamMessageWriter
} from 'vscode-jsonrpc/node.js';
import {
  ClientCapabilities,
  DidOpenTextDocumentNotification,
  ExitNotification,
  InitializedNotification,
  InitializeParams,
  InitializeRequest,
  ShutdownRequest,
  TextDocumentItem,
  WorkspaceFolder,
  WorkspaceSymbolRequest
} from 'vscode-languageserver-protocol';
import { LspConfigParser } from './config.js';

interface ServerConnection {
  connection: MessageConnection;
  process: ChildProcess;
  initialized: boolean;
}

/**
 * LSP Process Manager and Communication Client
 * 
 * Provides LSP server process management, JSON-RPC communication,
 * and file synchronization with proper lifecycle management.
 * 
 * @class LspClient
 */
export class LspClient {
  private configParser: LspConfigParser;
  private connections = new Map<string, ServerConnection>();
  private initializedProjects: Set<string> = new Set();
  private rateLimiter: Map<string, number> = new Map();
  private readonly RATE_LIMIT_MAX_REQUESTS = 100;
  private readonly RATE_LIMIT_WINDOW = 60000;
  private serverStartTimes: Map<string, number> = new Map();

  /**
   * Creates a new LspClient instance
   * 
   * @param {string} configPath - Path to the language server configuration file
   */
  constructor(configPath: string) {
    this.configParser = new LspConfigParser(configPath);
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Checks and enforces rate limiting per language
   * 
   * @private
   * @param {string} languageId - Language identifier for rate limiting
   * @returns {boolean} True if within rate limit
   * @throws {Error} When rate limit is exceeded
   */
  private checkRateLimit(languageId: string): boolean {
    const now = Date.now();
    const key = `${languageId}_${Math.floor(now / this.RATE_LIMIT_WINDOW)}`;
    const current = this.rateLimiter.get(key) || 0;
    if (current >= this.RATE_LIMIT_MAX_REQUESTS) {
      throw new Error(`Rate limit exceeded for '${languageId}' language server`);
    }
    this.rateLimiter.set(key, current + 1);
    for (const [k, _] of this.rateLimiter) {
      if (k < key) {
        this.rateLimiter.delete(k);
      }
    }
    return true;
  }

  /**
   * Creates a message connection for an language server process
   * 
   * @private
   * @param {ChildProcess} process - Language server process
   * @returns {MessageConnection} Message connection
   */
  private createConnection(process: ChildProcess): MessageConnection {
    const connection = createMessageConnection(
      new StreamMessageReader(process.stdout!),
      new StreamMessageWriter(process.stdin!)
    );
    connection.onError((error) => {
      console.error('Connection error:', error);
    });
    connection.listen();
    return connection;
  }

  /**
   * Ensures a file is opened in the language server
   * 
   * @private
   * @param {string} filePath - Path to the file
   * @param {string} languageId - Language identifier
   * @returns {Promise<void>} Promise that resolves when file is opened
   */
  private async ensureFileOpened(filePath: string, languageId: string): Promise<void> {
    try {
      const content = readFileSync(filePath, 'utf8');
      const uri = pathToFileURL(filePath).toString();
      const textDocument: TextDocumentItem = {
        uri: uri,
        languageId: languageId,
        version: 1,
        text: content
      };
      this.sendNotification(languageId, DidOpenTextDocumentNotification.method, { textDocument });
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.warn(`Failed to open file ${filePath}:`, error);
    }
  }

  /**
   * Gets server configuration for a specific file path
   * 
   * @private
   * @param {string} filePath - Path to the file
   * @returns {[string, object] | null} Language identifier and config, or null if no match
   */
  private getServerInfo(filePath: string): [string, {
    command: string;
    args: string[];
    projects: string[];
    extensions: string[];
  }] | null {
    const absolutePath = filePath.startsWith('/') ? filePath : join(process.cwd(), filePath);
    for (const languageId of this.configParser.getServers()) {
      const serverConfig = this.configParser.getServerConfig(languageId);
      if (!serverConfig) continue;
      const isInDirectory = serverConfig.projects.some(dir => absolutePath.startsWith(dir));
      if (isInDirectory) {
        for (const ext of serverConfig.extensions) {
          if (filePath.endsWith(ext)) {
            return [languageId, serverConfig];
          }
        }
      }
    }
    return null;
  }

  /**
   * Initializes project by setting up file watching (no representative file needed)
   * 
   * @private
   * @param {string} languageId - Language identifier (e.g., 'typescript')
   * @returns {Promise<void>} Promise that resolves when project is initialized
   */
  private async initializeProject(languageId: string): Promise<void> {
    if (this.initializedProjects.has(languageId)) {
      return;
    }
    this.initializedProjects.add(languageId);
  }

  /**
   * Creates minimal client capabilities
   * 
   * @private
   * @returns {ClientCapabilities} Client capabilities
   */
  private createClientCapabilities(): ClientCapabilities {
    return {
      workspace: {
        workspaceFolders: true
      },
      textDocument: {
        synchronization: {
          dynamicRegistration: false
        },
        completion: {
          dynamicRegistration: false
        },
        hover: {
          dynamicRegistration: false
        },
        signatureHelp: {
          dynamicRegistration: false
        },
        definition: { dynamicRegistration: false },
        typeDefinition: { dynamicRegistration: false },
        implementation: { dynamicRegistration: false },
        references: { dynamicRegistration: false },
        documentHighlight: { dynamicRegistration: false },
        documentSymbol: { dynamicRegistration: false },
        codeAction: { dynamicRegistration: false },
        codeLens: { dynamicRegistration: false },
        formatting: { dynamicRegistration: false },
        rangeFormatting: { dynamicRegistration: false },
        onTypeFormatting: { dynamicRegistration: false },
        rename: { dynamicRegistration: false },
        publishDiagnostics: {
          relatedInformation: false,
          versionSupport: false
        }
      }
    };
  }

  /**
   * Initializes an language server with the initialize request
   * 
   * @private
   * @param {string} languageId - Language identifier
   * @returns {Promise<void>} Promise that resolves when initialized
   */
  private async initializeServer(languageId: string): Promise<void> {
    const serverConfig = this.configParser.getServerConfig(languageId);
    if (!serverConfig) {
      throw new Error(`Unknown language: ${languageId}`);
    }
    const workspaceFolders: WorkspaceFolder[] = serverConfig.projects.map(dir => ({
      uri: pathToFileURL(dir).toString(),
      name: dir.split('/').pop() || 'workspace'
    }));
    const initParams: InitializeParams = {
      processId: process.pid,
      clientInfo: {
        name: 'mcp-lsp',
        version: this.version(),
      },
      rootUri: null,
      workspaceFolders: workspaceFolders,
      capabilities: this.createClientCapabilities(),
    };
    const serverConnection = this.connections.get(languageId)!;
    await serverConnection.connection.sendRequest(InitializeRequest.method, initParams);
    serverConnection.connection.sendNotification(InitializedNotification.method, {});
  }

  /**
   * Sets up process event handlers for a language server
   * 
   * @private
   * @param {string} languageId - Language identifier
   * @param {ChildProcess} process - Language server process
   */
  private setupProcessHandlers(languageId: string, process: ChildProcess): void {
    process.stderr!.on('data', (data: Buffer) => {
      console.error(`[${languageId}] STDERR:`, data.toString());
    });
    process.on('exit', (code) => {
      this.connections.delete(languageId);
      this.serverStartTimes.delete(languageId);
    });
    process.on('error', (error) => {
      console.error(`Language server '${languageId}' error:`, error);
      this.connections.delete(languageId);
      this.serverStartTimes.delete(languageId);
    });
  }

  /**
   * Gets the uptime of a specific language server in milliseconds
   * 
   * @param {string} languageId - Language identifier
   * @returns {number} Uptime in milliseconds, or 0 if server not running
   */
  getServerUptime(languageId: string): number {
    const startTime = this.serverStartTimes.get(languageId);
    return startTime ? Date.now() - startTime : 0;
  }

  /**
   * Gets all configured servers
   * 
   * @returns {string[]} Array of servers
   */
  getServers(): string[] {
    return this.configParser.getServers();
  }

  /**
   * Checks if a specific language server is currently running
   * 
   * @param {string} languageId - Language identifier
   * @returns {boolean} True if server is running
   */
  isServerRunning(languageId: string): boolean {
    return this.connections.has(languageId);
  }

  /**
   * Restarts a specific language server
   * 
   * @param {string} languageId - Language identifier
   * @returns {Promise<void>} Promise that resolves when server is restarted
   */
  async restartServer(languageId: string): Promise<void> {
    if (!this.configParser.hasServerConfig(languageId)) {
      throw new Error(`Unknown language: ${languageId}`);
    }
    await this.stopServer(languageId);
    await this.startServer(languageId);
  }

  /**
   * Sends a typed JSON-RPC notification to an language server
   * 
   * @param {string} languageId - Language identifier
   * @param {string} method - Method name from typed notification
   * @param {any} params - Method parameters
   */
  sendNotification(languageId: string, method: string, params: any): void {
    const serverConnection = this.connections.get(languageId);
    if (!serverConnection || !serverConnection.process.stdin) {
      console.warn(`Cannot send notification to ${languageId}: server not running`);
      return;
    }
    serverConnection.connection.sendNotification(method, params);
  }

  /**
   * Sends a typed JSON-RPC request to an language server
   * 
   * @param {string} languageId - Language identifier
   * @param {string} method - Method name from typed request
   * @param {any} params - Method parameters
   * @returns {Promise<any>} Promise that resolves with the response
   */
  async sendRequest(languageId: string, method: string, params: any): Promise<any> {
    this.checkRateLimit(languageId);
    if (!this.isServerRunning(languageId)) {
      throw new Error(`Language server '${languageId}' is not running.`);
    }
    if (method === WorkspaceSymbolRequest.method) {
      await this.initializeProject(languageId);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const serverConnection = this.connections.get(languageId);
    if (!serverConnection || !serverConnection.process.stdin) {
      throw new Error(`Language server '${languageId}' is not running.`);
    }
    try {
      const result = await serverConnection.connection.sendRequest(method, params);
      return result;
    } catch (error) {
      throw new Error(`Request failed for '${method}': ${error}`);
    }
  }

  /**
   * Sends a file request to the appropriate language server
   * 
   * @param {string} filePath - Path to the file
   * @param {string} method - Method name from typed request
   * @param {any} params - Method parameters
   * @returns {Promise<any>} Promise that resolves with the response
   */
  async sendServerRequest(filePath: string, method: string, params: any): Promise<any> {
    const serverInfo = this.getServerInfo(filePath);
    if (!serverInfo) {
      throw new Error(`No language server configured for '${filePath}' file.`);
    }
    const [languageId, serverConfig] = serverInfo;
    if (!this.isServerRunning(languageId)) {
      throw new Error(`Language server '${languageId}' is not running.`);
    }
    if (method.startsWith('textDocument/')) {
      await this.ensureFileOpened(filePath, languageId);
    }
    return this.sendRequest(languageId, method, params);
  }

  /**
   * Gracefully shuts down all language servers
   * 
   * @returns {Promise<void>} Promise that resolves when all servers are stopped
   */
  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.connections.keys()).map(languageId =>
      this.stopServer(languageId).catch(error =>
        console.warn(`Error stopping server ${languageId}:`, error)
      )
    );
    await Promise.all(shutdownPromises);
  }

  /**
   * Starts a language server for a specific language
   * 
   * @param {string} languageId - Language identifier
   * @returns {Promise<void>} Promise that resolves when server is started
   */
  async startServer(languageId: string): Promise<void> {
    if (this.connections.has(languageId)) {
      return;
    }
    const serverConfig = this.configParser.getServerConfig(languageId);
    if (!serverConfig) {
      throw new Error(`Unknown language server: ${languageId}`);
    }
    try {
      const workspaceRoot = serverConfig.projects.length > 0 ? serverConfig.projects[0] : process.cwd();
      const childProcess = spawn(serverConfig.command, serverConfig.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
        cwd: workspaceRoot,
      });
      if (!childProcess.stdout || !childProcess.stdin || !childProcess.stderr) {
        throw new Error(`Failed to create stdio pipes for '${languageId}' language server`);
      }
      const connection = this.createConnection(childProcess);
      const serverConnection: ServerConnection = {
        connection,
        process: childProcess,
        initialized: false
      };
      this.connections.set(languageId, serverConnection);
      this.serverStartTimes.set(languageId, Date.now());
      this.setupProcessHandlers(languageId, childProcess);
      await this.initializeServer(languageId);
      serverConnection.initialized = true;
    } catch (error) {
      throw new Error(`Failed to start '${languageId}' language server: ${error}`);
    }
  }

  /**
   * Stops a specific language server process
   * 
   * @param {string} languageId - Language identifier
   * @returns {Promise<void>} Promise that resolves when server is stopped
   */
  async stopServer(languageId: string): Promise<void> {
    const serverConnection = this.connections.get(languageId);
    if (!serverConnection) {
      return;
    }
    this.connections.delete(languageId);
    this.serverStartTimes.delete(languageId);
    try {
      await serverConnection.connection.sendRequest(ShutdownRequest.method, {});
      serverConnection.connection.sendNotification(ExitNotification.method, {});
      serverConnection.connection.dispose();
      setTimeout(() => {
        if (!serverConnection.process.killed) {
          serverConnection.process.kill('SIGTERM');
        }
      }, 1000);
    } catch (error) {
      console.warn(`Error stopping '${languageId}' language server:`, error);
      serverConnection.process.kill('SIGKILL');
    }
  }

  /**
   * Gets package version
   * 
   * @returns {string} Package version
   * @throws {Error} When package.json cannot be read or parsed
   */
  version(): string {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const packagePath = join(__dirname, '../../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
      return packageJson.version;
    } catch (error) {
      throw new Error(`Failed to read package.json version: ${error}`);
    }
  }
}
