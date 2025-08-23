/**
 * LSP Process Manager and Communication Client
 * 
 * @module server/client
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { ChildProcess, spawn } from 'child_process';
import fg from 'fast-glob';
import gracefulFs from 'graceful-fs';
import pLimit from 'p-limit';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { promisify } from 'util';
import {
  createMessageConnection,
  MessageConnection,
  StreamMessageReader,
  StreamMessageWriter
} from 'vscode-jsonrpc/node.js';
import {
  CallHierarchyIncomingCallsRequest,
  CallHierarchyOutgoingCallsRequest,
  CallHierarchyPrepareRequest,
  ClientCapabilities,
  CodeActionRequest,
  CompletionRequest,
  ConfigurationRequest,
  DefinitionRequest,
  DidChangeWorkspaceFoldersNotification,
  DidOpenTextDocumentNotification,
  DocumentColorRequest,
  DocumentFormattingRequest,
  DocumentLinkRequest,
  DocumentRangeFormattingRequest,
  DocumentSymbolRequest,
  ExitNotification,
  FoldingRangeRequest,
  HoverRequest,
  ImplementationRequest,
  InitializedNotification,
  InitializeParams,
  InitializeRequest,
  InlayHintRequest,
  LinkedEditingRangeRequest,
  ReferencesRequest,
  RegistrationParams,
  RegistrationRequest,
  RenameRequest,
  SelectionRangeRequest,
  ShutdownRequest,
  SignatureHelpRequest,
  TextDocumentItem,
  TypeDefinitionRequest,
  TypeHierarchyPrepareRequest,
  TypeHierarchySubtypesRequest,
  TypeHierarchySupertypesRequest,
  UnregistrationParams,
  UnregistrationRequest,
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
  private config: LspConfigParser;
  private connections = new Map<string, ServerConnection>();
  private initializedProjects: Set<string> = new Set();
  private languageIdCache = new Map<string, string>();
  private rateLimiter: Map<string, number> = new Map();
  private serverStartTimes: Map<string, number> = new Map();
  private projectFiles: Map<string, Map<string, string[]>> = new Map();
  private readonly fileReadLimit = pLimit(10);
  private readonly readFileAsync = promisify(gracefulFs.readFile);
  private readonly readFileSync = gracefulFs.readFileSync;
  private readonly IGNORE = [
    'bin', 'build', 'cache', 'coverage', 'dist', 'log', 'node_modules', 'obj', 'out', 'target', 'temp', 'tmp'
  ];
  private readonly RATE_LIMIT_MAX_REQUESTS = 100;
  private readonly RATE_LIMIT_WINDOW = 60000;

  /**
   * Creates a new LspClient instance
   * 
   * @param {string} configPath - Path to the language server configuration file
   */
  constructor(configPath: string) {
    this.config = new LspConfigParser(configPath);
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Checks and enforces rate limiting per language
   * 
   * @private
   * @param {string} languageId - Language identifier
   * @returns {boolean} True if within rate limit
   * @throws {Error} When rate limit is exceeded
   */
  private checkRateLimit(languageId: string): boolean {
    const now = Date.now();
    const key = `${languageId}_${Math.floor(now / this.RATE_LIMIT_WINDOW)}`;
    const current = this.rateLimiter.get(key) || 0;
    if (current >= this.RATE_LIMIT_MAX_REQUESTS) {
      this.response(`Rate limit exceeded for '${languageId}' language server.`);
      return false;
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
   * @param {string} languageId - Language identifier
   * @param {ChildProcess} process - Language server process
   * @returns {MessageConnection} Message connection
   */
  private createConnection(languageId: string, process: ChildProcess): MessageConnection {
    const connection = createMessageConnection(
      new StreamMessageReader(process.stdout!),
      new StreamMessageWriter(process.stdin!)
    );
    connection.onError(() => { });
    connection.onRequest(ConfigurationRequest.method, (params: any) => {
      return params.items.map((item: any) => {
        const serverConfig = this.config.getServerConfig(languageId);
        if (item.section === languageId && serverConfig.configuration) {
          return { [languageId]: serverConfig.configuration };
        }
        return {};
      });
    });
    connection.onRequest(RegistrationRequest.method, (params: RegistrationParams) => {
      return {};
    });
    connection.onRequest(UnregistrationRequest.method, (params: UnregistrationParams) => {
      return {};
    });
    connection.listen();
    return connection;
  }

  /**
   * Gets server information for a specific file path
   * 
   * @private
   * @param {string} filePath - Path to the file
   * @returns {string} Language identifier of the running server that handles the file
   */
  private getServerInfo(filePath: string): string | null {
    const absolutePath = filePath.startsWith('/') ? filePath : join(process.cwd(), filePath);
    const cachedLanguageId = this.languageIdCache.get(absolutePath);
    if (cachedLanguageId) {
      return cachedLanguageId;
    }
    for (const languageId of this.config.getServers()) {
      const serverConfig = this.config.getServerConfig(languageId);
      const isProjectPath = serverConfig.projects.some(project => absolutePath.startsWith(project.path));
      if (isProjectPath) {
        for (const ext of serverConfig.extensions) {
          if (filePath.endsWith(ext)) {
            this.languageIdCache.set(absolutePath, languageId);
            return languageId;
          }
        }
      }
    }
    return null;
  }

  /**
   * Finds all files with specified extensions using fast glob search
   * 
   * @private
   * @param {string} dir - Directory to search
   * @param {string[]} extensions - File extensions
   * @param {string[]} ignore - Additional ignore patterns
   * @returns {Promise<string[]>} Array of matching file paths
   */
  private async findFiles(dir: string, extensions: string[], ignore: string[] = []): Promise<string[]> {
    if (extensions.length === 0) {
      return [];
    }
    const defaultIgnore = ['**/.*', ...this.IGNORE.map(pattern => `**/${pattern}`)];
    const projectIgnore = ignore.map(pattern => pattern.includes('/') ? pattern : `**/${pattern}`);
    const pattern = extensions.length === 1 ? `**/*${extensions[0]}` : `**/*{${extensions.join(',')}}`;
    return await fg(pattern, {
      absolute: true,
      cwd: dir,
      ignore: [...defaultIgnore, ...projectIgnore],
      onlyFiles: true
    });
  }

  /**
   * Initializes projects by setting up workspace indexing using VSCode protocol
   * 
   * @private
   * @param {string} languageId - Language identifier
   * @returns {Promise<void>} Promise that resolves when project is initialized
   */
  private async initializeProjects(languageId: string): Promise<void> {
    if (this.initializedProjects.has(languageId)) {
      return;
    }
    const serverConfig = this.config.getServerConfig(languageId);
    const workspaceFolders: WorkspaceFolder[] = serverConfig.projects.map(project => ({
      name: project.name,
      uri: pathToFileURL(project.path).toString()
    }));
    if (workspaceFolders.length) {
      this.sendNotification(languageId, DidChangeWorkspaceFoldersNotification.method, {
        event: {
          added: workspaceFolders,
          removed: []
        }
      });
    }
    this.initializedProjects.add(languageId);
  }

  /**
   * Initializes an language server with the initialize request
   * 
   * @private
   * @param {string} languageId - Language identifier
   * @returns {Promise<void>} Promise that resolves when initialized
   */
  private async initializeServer(languageId: string): Promise<void> {
    const serverConfig = this.config.getServerConfig(languageId);
    const workspaceFolders: WorkspaceFolder[] = serverConfig.projects.map(project => ({
      name: project.name,
      uri: pathToFileURL(project.path).toString()
    }));
    const paths = serverConfig.projects.map(project => project.path);
    const rootPath = paths.length === 1 ? paths[0] : null;
    const rootUri = rootPath ? pathToFileURL(rootPath).toString() : null;
    const initParams: InitializeParams = {
      capabilities: this.setClientCapabilities(),
      clientInfo: {
        name: 'mcp-lsp-client',
        version: this.version(),
      },
      processId: process.pid,
      rootPath,
      rootUri,
      workspaceFolders
    };
    const serverConnection = this.connections.get(languageId)!;
    await serverConnection.connection.sendRequest(InitializeRequest.method, initParams);
    serverConnection.connection.sendNotification(InitializedNotification.method, {});
    const cachedFiles = new Map<string, string[]>();
    for (const project of serverConfig.projects) {
      const files = await this.findFiles(project.path, serverConfig.extensions, project.ignore);
      if (files.length) {
        files.forEach(filePath => {
          this.languageIdCache.set(filePath, languageId);
        });
        await this.openFiles(languageId, [files[0]]);
        cachedFiles.set(project.name, files);
      }
    }
    this.projectFiles.set(languageId, cachedFiles);
    try {
      if (cachedFiles.size && serverConfig.workspace === false) {
        serverConnection.initialized = true;
      } else {
        const params = { query: '' };
        await serverConnection.connection.sendRequest(WorkspaceSymbolRequest.method, params);
        serverConnection.initialized = true;
      }
    } catch (error) {
      serverConnection.initialized = false;
    }
  }

  /**
   * Opens a single file in the language server
   * 
   * @private
   * @param {string} languageId - Language identifier
   * @param {string} filePath - File path to open
   * @returns {Promise<void>} Promise that resolves when file is opened
   */
  private async openFile(languageId: string, filePath: string): Promise<void> {
    try {
      const text = await this.readFileAsync(filePath, 'utf8');
      const uri = pathToFileURL(filePath).toString();
      const textDocument: TextDocumentItem = {
        languageId,
        uri,
        text,
        version: 1
      };
      this.sendNotification(languageId, DidOpenTextDocumentNotification.method, {
        textDocument
      });
    } catch (error) {
      return this.response(`Failed to read '${filePath}' file: ${error}`);
    }
  }

  /**
   * Opens multiple files in the language server
   * 
   * @private
   * @param {string} languageId - Language identifier
   * @param {string[]} files - File paths to open
   * @returns {Promise<void>} Promise that resolves when all files are opened
   */
  private async openFiles(languageId: string, files: string[]): Promise<void> {
    if (files.length === 0) {
      return;
    }
    const openFiles = files.map(file =>
      this.fileReadLimit(() => this.openFile(languageId, file))
    );
    await Promise.allSettled(openFiles);
  }

  /**
     * Sets comprehensive client capabilities for LSP features
     * 
     * @private
     * @returns {ClientCapabilities} Client capabilities
     */
  private setClientCapabilities(): ClientCapabilities {
    return {
      workspace: {
        applyEdit: true,
        configuration: true,
        didChangeConfiguration: { dynamicRegistration: true },
        didChangeWatchedFiles: { dynamicRegistration: true },
        executeCommand: { dynamicRegistration: true },
        symbol: {
          dynamicRegistration: true,
          symbolKind: {
            valueSet: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]
          }
        },
        workspaceEdit: {
          documentChanges: true,
          failureHandling: 'textOnlyTransactional',
          resourceOperations: ['create', 'rename', 'delete']
        },
        workspaceFolders: true
      },
      textDocument: {
        callHierarchy: { dynamicRegistration: true },
        codeAction: { dynamicRegistration: true },
        completion: { dynamicRegistration: true },
        colorProvider: { dynamicRegistration: true },
        definition: { dynamicRegistration: true },
        documentLink: { dynamicRegistration: true },
        documentSymbol: { dynamicRegistration: true },
        foldingRange: { dynamicRegistration: true },
        formatting: { dynamicRegistration: true },
        hover: { dynamicRegistration: true },
        implementation: { dynamicRegistration: true },
        inlayHint: { dynamicRegistration: true },
        linkedEditingRange: { dynamicRegistration: true },
        rangeFormatting: { dynamicRegistration: true },
        references: { dynamicRegistration: true },
        rename: { dynamicRegistration: true },
        selectionRange: { dynamicRegistration: true },
        signatureHelp: { dynamicRegistration: true },
        synchronization: { dynamicRegistration: true },
        typeDefinition: { dynamicRegistration: true },
        typeHierarchy: { dynamicRegistration: true }
      }
    };
  }

  /**
   * Sets process event handlers for a language server
   * 
   * @private
   * @param {string} languageId - Language identifier
   * @param {ChildProcess} process - Language server process
   */
  private setProcessHandlers(languageId: string, process: ChildProcess): void {
    process.on('error', (error) => {
      this.connections.delete(languageId);
      this.serverStartTimes.delete(languageId);
    });
    process.on('exit', (code, signal) => {
      this.connections.delete(languageId);
      this.serverStartTimes.delete(languageId);
    });
  }

  /**
   * Gets server connection for status checking
   * 
   * @param {string} languageId - Language identifier
   * @returns {ServerConnection | undefined} Server connection or undefined
   */
  getServerConnection(languageId: string): ServerConnection | undefined {
    return this.connections.get(languageId);
  }

  /**
   * Gets all configured servers
   * 
   * @returns {string[]} Array of servers
   */
  getServers(): string[] {
    return this.config.getServers();
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
   * Checks if a specific language server is currently running
   * 
   * @param {string} languageId - Language identifier
   * @returns {boolean} True if server is running
   */
  isServerRunning(languageId: string): boolean {
    return this.connections.has(languageId);
  }

  /**
   * Loads files for a specific project into the language server
   * 
   * @param {string} languageId - Language identifier
   * @param {string} projectName - Project name to load files for
   * @returns {Promise<void>} Promise that resolves when files are loaded
   */
  async loadProjectFiles(languageId: string, projectName: string): Promise<void> {
    const cachedFiles = this.projectFiles.get(languageId);
    if (cachedFiles) {
      const projectFiles = cachedFiles.get(projectName) || [];
      await this.openFiles(languageId, projectFiles);
    }
  }

  /**
   * Creates a standardized response for tool execution
   * 
   * @param {any} response - The response data from language server
   * @param {boolean} stringify - Whether to JSON stringify the response (default: false)
   * @returns {Object} Standardized response format
   */
  response(response: any, stringify: boolean = false): any {
    const text = stringify ? JSON.stringify(response) : response;
    return { content: [{ type: 'text', text }] };
  }

  /**
   * Restarts a specific language server
   * 
   * @param {string} languageId - Language identifier
   * @returns {Promise<void>} Promise that resolves when server is restarted
   */
  async restartServer(languageId: string): Promise<void> {
    if (!this.config.hasServerConfig(languageId)) {
      return this.response(`Language server '${languageId}' is unknown.`);
    }
    await this.stopServer(languageId);
    this.initializedProjects.delete(languageId);
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
      return this.response(`Language server '${languageId}' is not running.`);
    }
    if (method === WorkspaceSymbolRequest.method) {
      await this.initializeProjects(languageId);
    }
    const serverConnection = this.connections.get(languageId);
    if (!serverConnection || !serverConnection.process.stdin) {
      return this.response(`Language server '${languageId}' is not running.`);
    }
    try {
      const result = await serverConnection.connection.sendRequest(method, params);
      return result;
    } catch (error) {
      return this.response(`Request failed for '${method}': ${error}`);
    }
  }

  /**
   * Sends a file request to the appropriate language server
   * 
   * @param {string} file - Path to the file
   * @param {string} method - Method name from typed request
   * @param {any} params - Method parameters
   * @returns {Promise<any>} Promise that resolves with the response
   */
  async sendServerRequest(file: string, method: string, params: any): Promise<any> {
    const languageId = this.getServerInfo(file);
    if (!languageId) {
      if (this.connections.size === 0) {
        return 'No language servers are currently running.';
      }
      return `File '${file}' does not belong to running language server.`;
    }
    if (!this.isServerRunning(languageId)) {
      return `Language server '${languageId}' is not running.`;
    }
    const methods: string[] = [
      CallHierarchyIncomingCallsRequest.method,
      CallHierarchyOutgoingCallsRequest.method,
      CallHierarchyPrepareRequest.method,
      CodeActionRequest.method,
      CompletionRequest.method,
      DefinitionRequest.method,
      DocumentColorRequest.method,
      DocumentFormattingRequest.method,
      DocumentLinkRequest.method,
      DocumentRangeFormattingRequest.method,
      DocumentSymbolRequest.method,
      FoldingRangeRequest.method,
      HoverRequest.method,
      ImplementationRequest.method,
      InlayHintRequest.method,
      LinkedEditingRangeRequest.method,
      ReferencesRequest.method,
      RenameRequest.method,
      SelectionRangeRequest.method,
      SignatureHelpRequest.method,
      TypeDefinitionRequest.method,
      TypeHierarchyPrepareRequest.method,
      TypeHierarchySubtypesRequest.method,
      TypeHierarchySupertypesRequest.method
    ];
    if (methods.includes(method)) {
      const absolutePath = file.startsWith('/') ? file : join(process.cwd(), file);
      const cachedFiles = this.projectFiles.get(languageId);
      if (cachedFiles) {
        const serverConfig = this.config.getServerConfig(languageId);
        for (const project of serverConfig.projects) {
          if (absolutePath.startsWith(project.path)) {
            const projectFiles = cachedFiles.get(project.name) || [];
            await this.openFiles(languageId, projectFiles);
            break;
          }
        }
      }
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
      this.stopServer(languageId)
    );
    await Promise.allSettled(shutdownPromises);
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
    const serverConfig = this.config.getServerConfig(languageId);
    try {
      const projectPaths = serverConfig.projects.map(project => project.path);
      const workspaceRoot = projectPaths.length ? projectPaths[0] : process.cwd();
      const childProcess = spawn(serverConfig.command, serverConfig.args, {
        cwd: workspaceRoot,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      if (!childProcess.stdout || !childProcess.stdin || !childProcess.stderr) {
        return this.response(`Failed to create stdio pipes for '${languageId}' language server`);
      }
      const connection = this.createConnection(languageId, childProcess);
      const serverConnection: ServerConnection = {
        connection,
        initialized: false,
        process: childProcess
      };
      this.connections.set(languageId, serverConnection);
      this.serverStartTimes.set(languageId, Date.now());
      this.setProcessHandlers(languageId, childProcess);
      await this.initializeServer(languageId);
    } catch (error) {
      return this.response(`Failed to start '${languageId}' language server: ${error}`);
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
    this.projectFiles.delete(languageId);
    this.serverStartTimes.delete(languageId);
    for (const [filePath, cachedLanguageId] of this.languageIdCache.entries()) {
      if (cachedLanguageId === languageId) {
        this.languageIdCache.delete(filePath);
      }
    }
    try {
      await serverConnection.connection.sendRequest(ShutdownRequest.method, {});
      await new Promise(resolve => setTimeout(resolve, 100));
      serverConnection.connection.sendNotification(ExitNotification.method, {});
      serverConnection.connection.dispose();
      if (!serverConnection.process.killed) {
        serverConnection.process.kill('SIGTERM');
        await new Promise<void>((resolve) => {
          const handleExit = () => {
            serverConnection.process.removeListener('exit', handleExit);
            resolve();
          };
          serverConnection.process.on('exit', handleExit);
        });
      }
    } finally {
      if (!serverConnection.process.killed) {
        serverConnection.process.kill('SIGKILL');
      }
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
      const packageJson = JSON.parse(this.readFileSync(packagePath, 'utf8'));
      return packageJson.version;
    } catch (error) {
      return this.response(`Failed to read package.json version: ${error}`);
    }
  }
}
