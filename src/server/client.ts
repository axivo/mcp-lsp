/**
 * LSP Process Manager and Communication Client
 * 
 * @module server/client
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { deepmerge } from 'deepmerge-ts';
import fg from 'fast-glob';
import gracefulFs from 'graceful-fs';
import { ChildProcess, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import pLimit from 'p-limit';
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
  ConfigurationParams,
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
  InitializeResult,
  InlayHintRequest,
  LinkedEditingRangeRequest,
  ReferencesRequest,
  RegistrationParams,
  RegistrationRequest,
  RenameRequest,
  SelectionRangeRequest,
  ServerCapabilities,
  ShowMessageParams,
  ShowMessageRequest,
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
import { Config, ProjectConfig } from './config.js';

interface ServerConnection {
  capabilities?: ServerCapabilities;
  connection: MessageConnection;
  initialized: boolean;
  name: string;
  process: ChildProcess;
}

type ServerResponse = { content: [{ type: 'text', text: string }] };

/**
 * LSP Process Manager and Communication Client
 * 
 * Provides LSP server process management, JSON-RPC communication,
 * and file synchronization with proper lifecycle management.
 * 
 * @class Client
 */
export class Client {
  private config: Config;
  private connections = new Map<string, ServerConnection>();
  private initializedProjects: Set<string> = new Set();
  private languageIdCache = new Map<string, string>();
  private openedFiles: Map<string, Set<string>> = new Map();
  private projectFiles: Map<string, Map<string, string[]>> = new Map();
  private projectId = new Map<string, string>();
  private rateLimiter: Map<string, number> = new Map();
  private serverStartTimes: Map<string, number> = new Map();
  private readonly readFileAsync = promisify(gracefulFs.readFile);
  private readonly readFileSync = gracefulFs.readFileSync;

  /**
   * Creates a new Client instance
   * 
   * @param {string} configPath - Path to the language server configuration file
   */
  constructor(configPath: string) {
    this.config = new Config(configPath);
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
    const serverConfig = this.config.getServerConfig(languageId);
    const now = Date.now();
    const key = `ratelimit:${languageId}:${Math.floor(now / serverConfig.settings.rateLimitWindowMs)}`;
    const current = this.rateLimiter.get(key) ?? 0;
    if (current >= serverConfig.settings.rateLimitMaxRequests) {
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
    connection.onError((error) => {
      return this.response(`Language server '${languageId}' error: ${error}`);
    });
    const serverConfig = this.config.getServerConfig(languageId);
    if (serverConfig.settings.configurationRequest === true) {
      connection.onRequest(ConfigurationRequest.method, (params: ConfigurationParams) => {
        return [serverConfig.configuration ?? {}];
      });
    }
    if (serverConfig.settings.messageRequest === false) {
      connection.onRequest(ShowMessageRequest.method, (params: ShowMessageParams) => {
        return null;
      });
    }
    if (serverConfig.settings.registrationRequest === false) {
      connection.onRequest(RegistrationRequest.method, (params: RegistrationParams) => {
        return {};
      });
      connection.onRequest(UnregistrationRequest.method, (params: UnregistrationParams) => {
        return {};
      });
    }
    connection.listen();
    return connection;
  }

  /**
  * Finds all files with specified extensions
  * 
  * @private
  * @param {string} cwd - Directory to search
  * @param {string[]} extensions - File extensions
  * @param {object} patterns - Pattern configuration with exclude and include arrays
  * @returns {Promise<string[]>} Array of matching file paths
  */
  private async findFiles(cwd: string, extensions: string[], patterns: ProjectConfig['patterns'] = {}): Promise<string[]> {
    if (extensions.length === 0) {
      return [];
    }
    const excludes = [
      'bin', 'build', 'cache', 'coverage', 'dist', 'log', 'node_modules', 'obj', 'out', 'target', 'temp', 'tmp'
    ];
    const includePatterns = [extensions.length === 1 ? `**/*${extensions[0]}` : `**/*{${extensions.join(',')}}`];
    if (patterns?.include && patterns.include.length) {
      for (const pattern of patterns.include) {
        includePatterns.push(pattern);
        const index = excludes.findIndex(exclude => pattern.split('/').includes(exclude));
        if (index !== -1) {
          excludes.splice(index, 1);
        }
      }
    }
    const excludePatterns: string[] = ['**/.*', ...excludes.map(pattern => `**/${pattern}`)];
    if (patterns?.exclude && patterns.exclude.length) {
      for (const pattern of patterns.exclude) {
        excludePatterns.push(pattern);
      }
    }
    return await fg(includePatterns, { cwd, absolute: true, onlyFiles: true, ignore: excludePatterns });
  }

  /**
   * Gets server information for a specific file path
   * 
   * @private
   * @param {string} filePath - Path to the file
   * @returns {string | null} Project name of the running server that handles the file, or null if not found
   */
  private getServerInfo(filePath: string): string | null {
    const absolutePath = filePath.startsWith('/') ? filePath : join(process.cwd(), filePath);
    const cachedProject = this.languageIdCache.get(absolutePath);
    if (cachedProject) {
      return cachedProject;
    }
    for (const project of this.connections.keys()) {
      for (const [languageId, runningProject] of this.projectId.entries()) {
        if (runningProject === project) {
          const serverConfig = this.config.getServerConfig(languageId);
          const projectConfig = serverConfig.projects.find(id => id.name === project);
          if (projectConfig && absolutePath.startsWith(projectConfig.path)) {
            for (const extension of serverConfig.extensions) {
              if (filePath.endsWith(extension)) {
                this.languageIdCache.set(absolutePath, project);
                return project;
              }
            }
          }
          break;
        }
      }
    }
    return null;
  }

  /**
   * Initializes project by setting up workspace indexing using VSCode protocol
   * 
   * @private
   * @param {string} languageId - Language identifier
   * @param {string} project - Project name
   * @returns {Promise<void>} Promise that resolves when project is initialized
   */
  private async initializeProject(languageId: string, project: string): Promise<void> {
    if (this.initializedProjects.has(project)) {
      return;
    }
    const serverConfig = this.config.getServerConfig(languageId);
    const projectConfig = serverConfig.projects.find(id => id.name === project)!;
    const workspaceFolders: WorkspaceFolder[] = [{
      name: projectConfig.name,
      uri: pathToFileURL(projectConfig.path).toString()
    }];
    this.sendNotification(project, DidChangeWorkspaceFoldersNotification.method, {
      event: {
        added: workspaceFolders,
        removed: []
      }
    });
    this.initializedProjects.add(project);
  }

  /**
   * Initializes an language server with the initialize request
   * 
   * @private
   * @param {string} languageId - Language identifier
   * @param {string} project - Project name
   * @returns {Promise<void>} Promise that resolves when initialized
   */
  private async initializeServer(languageId: string, project: string): Promise<void> {
    const serverConnection = this.connections.get(project)!;
    const serverConfig = this.config.getServerConfig(languageId);
    const projectConfig = serverConfig.projects.find(id => id.name === project)!;
    const workspaceFolders: WorkspaceFolder[] = [{
      name: projectConfig.name,
      uri: pathToFileURL(projectConfig.path).toString()
    }];
    const initParams: InitializeParams = {
      capabilities: this.setClientCapabilities(languageId),
      clientInfo: {
        name: 'mcp-lsp-client',
        version: this.version(),
      },
      initializationOptions: serverConfig.configuration ?? {},
      processId: process.pid,
      rootPath: projectConfig.path,
      rootUri: pathToFileURL(projectConfig.path).toString(),
      workspaceFolders
    };
    const initializeResult: InitializeResult = await serverConnection.connection.sendRequest(InitializeRequest.method, initParams);
    serverConnection.capabilities = initializeResult.capabilities;
    serverConnection.connection.sendNotification(InitializedNotification.method, {});
    await this.setFilesCache(project, projectConfig, serverConfig.extensions);
    const cachedFiles = this.projectFiles.get(project);
    if (cachedFiles && cachedFiles.size) {
      const projectFiles = cachedFiles.get(project);
      if (projectFiles && projectFiles.length) {
        await this.openFiles(languageId, project, [projectFiles[0]]);
      }
    }
    try {
      if (cachedFiles && cachedFiles.size && serverConfig.settings.workspace === false) {
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
   * @param {string} project - Project name
   * @param {string} filePath - File path to open
   * @returns {Promise<ServerResponse | null>} Promise that resolves with error response or null on success
   */
  private async openFile(languageId: string, project: string, filePath: string): Promise<ServerResponse | null> {
    const uri = pathToFileURL(filePath).toString();
    let openedSet = this.openedFiles.get(project);
    if (!openedSet) {
      openedSet = new Set<string>();
      this.openedFiles.set(project, openedSet);
    }
    if (openedSet.has(uri)) {
      return null;
    }
    try {
      const text = await this.readFileAsync(filePath, 'utf8');
      const textDocument: TextDocumentItem = {
        languageId,
        uri,
        text,
        version: 1
      };
      this.sendNotification(project, DidOpenTextDocumentNotification.method, {
        textDocument
      });
      openedSet.add(uri);
      this.openedFiles.set(project, openedSet);
      return null;
    } catch (error) {
      return this.response(`Failed to read '${filePath}' file: ${error}`);
    }
  }

  /**
   * Opens multiple files in the language server
   * 
   * @private
   * @param {string} languageId - Language identifier
   * @param {string} project - Project name
   * @param {string[]} files - File paths to open
   * @returns {Promise<void>} Promise that resolves when all files are opened
   */
  private async openFiles(languageId: string, project: string, files: string[]): Promise<void> {
    if (files.length === 0) {
      return;
    }
    const serverConfig = this.config.getServerConfig(languageId);
    const fileReadLimit = pLimit(serverConfig.settings.maxConcurrentFileReads);
    const openFiles = files.map(file =>
      fileReadLimit(() => this.openFile(languageId, project, file))
    );
    await Promise.allSettled(openFiles);
  }

  /**
  * Sets client capabilities for LSP features
  * 
  * @private
  * @param {string} languageId - Language identifier for server-specific capabilities
  * @returns {ClientCapabilities} Client capabilities
  */
  private setClientCapabilities(languageId: string): ClientCapabilities {
    const capabilities: ClientCapabilities = {
      general: { positionEncodings: ['utf-8', 'utf-16'] },
      textDocument: {
        callHierarchy: { dynamicRegistration: false },
        codeAction: {
          dataSupport: true,
          disabledSupport: true,
          dynamicRegistration: false,
          isPreferredSupport: true,
          resolveSupport: { properties: ['edit'] }
        },
        completion: {
          dynamicRegistration: false,
          completionItem: {
            deprecatedSupport: true,
            insertReplaceSupport: true,
            resolveSupport: { properties: ['additionalTextEdits', 'detail', 'documentation'] },
            snippetSupport: true,
            tagSupport: { valueSet: [1] }
          },
          completionItemKind: {}
        },
        colorProvider: { dynamicRegistration: false },
        definition: { dynamicRegistration: false },
        documentLink: { dynamicRegistration: false },
        documentSymbol: { dynamicRegistration: false },
        foldingRange: { dynamicRegistration: false },
        formatting: { dynamicRegistration: false },
        hover: {
          dynamicRegistration: false,
          contentFormat: ['markdown', 'plaintext']
        },
        implementation: { dynamicRegistration: false },
        inlayHint: { dynamicRegistration: false },
        linkedEditingRange: { dynamicRegistration: false },
        rangeFormatting: { dynamicRegistration: false },
        references: { dynamicRegistration: false },
        rename: { dynamicRegistration: false },
        selectionRange: { dynamicRegistration: false },
        signatureHelp: {
          contextSupport: true,
          dynamicRegistration: false,
          signatureInformation: {
            documentationFormat: ['markdown', 'plaintext'],
            parameterInformation: { labelOffsetSupport: true },
            activeParameterSupport: true
          }
        },
        synchronization: {
          didSave: true,
          dynamicRegistration: false,
          willSave: true,
          willSaveWaitUntil: true
        },
        typeDefinition: { dynamicRegistration: false },
        typeHierarchy: { dynamicRegistration: false }
      },
      workspace: {
        applyEdit: true,
        configuration: true,
        didChangeConfiguration: { dynamicRegistration: false },
        didChangeWatchedFiles: { dynamicRegistration: false },
        executeCommand: { dynamicRegistration: false },
        symbol: {
          dynamicRegistration: false,
          symbolKind: {
            valueSet: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]
          }
        },
        workspaceEdit: {
          documentChanges: true,
          failureHandling: 'textOnlyTransactional',
          resourceOperations: ['create', 'delete', 'rename']
        },
        workspaceFolders: true
      }
    };
    const serverConfig = this.config.getServerConfig(languageId);
    return deepmerge(capabilities, serverConfig.capabilities ?? {});
  }

  /**
   * Sets files cache for a specific project
   * 
   * @private
   * @param {string} project - Project name
   * @param {ProjectConfig} projectConfig - Project configuration object
   * @param {string[]} extensions - File extensions
   * @returns {Promise<void>} Promise that resolves when files are cached
   */
  private async setFilesCache(project: string, projectConfig: ProjectConfig, extensions: string[]): Promise<void> {
    let cachedFiles = this.projectFiles.get(project);
    if (!cachedFiles) {
      cachedFiles = new Map<string, string[]>();
      this.projectFiles.set(project, cachedFiles);
    }
    const files = await this.findFiles(projectConfig.path, extensions, projectConfig.patterns);
    if (files.length) {
      files.forEach(filePath => {
        this.languageIdCache.set(filePath, project);
      });
      cachedFiles.set(project, files);
    }
  }

  /**
   * Sets process event handlers for a language server
   * 
   * @private
   * @param {string} project - Project name
   * @param {ChildProcess} process - Language server process
   */
  private setProcessHandlers(project: string, process: ChildProcess): void {
    const cleanup = () => {
      this.connections.delete(project);
      this.openedFiles.delete(project);
      this.projectFiles.delete(project);
      for (const [languageId, projectName] of this.projectId.entries()) {
        if (projectName === project) {
          this.projectId.delete(languageId);
          break;
        }
      }
      this.serverStartTimes.delete(project);
      for (const [filePath, cachedProject] of this.languageIdCache.entries()) {
        if (cachedProject === project) {
          this.languageIdCache.delete(filePath);
        }
      }
    };
    process.on('error', cleanup);
    process.on('exit', cleanup);
  }

  /**
   * Gets the project name for a specific language ID
   * 
   * @param {string} languageId - Language identifier
   * @returns {string | undefined} Project name for the language, or undefined if not found
   */
  getProjectId(languageId: string): string | undefined {
    return this.projectId.get(languageId);
  }

  /**
   * Gets server capabilities for a specific language server
   *
   * @param {string} languageId - Language identifier
   * @returns {ServerCapabilities | undefined} Server capabilities or undefined if not available
   */
  getServerCapabilities(languageId: string): ServerCapabilities | undefined {
    const project = this.projectId.get(languageId);
    if (project) {
      const serverConnection = this.connections.get(project);
      return serverConnection?.capabilities;
    }
    return undefined;
  }

  /**
   * Gets server connection for status checking
   * 
   * @param {string} languageId - Language identifier
   * @returns {ServerConnection | undefined} Server connection or undefined
   */
  getServerConnection(languageId: string): ServerConnection | undefined {
    const project = this.projectId.get(languageId);
    if (project) {
      return this.connections.get(project);
    }
    return undefined;
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
    const project = this.projectId.get(languageId);
    if (project) {
      const startTime = this.serverStartTimes.get(project);
      if (startTime) {
        return Date.now() - startTime;
      }
    }
    return 0;
  }

  /**
   * Checks if a language server is alive and can handle the specified project path
   * 
   * @param {string} languageId - Language identifier
   * @param {string} path - Project path to validate against server configuration
   * @returns {boolean} True if server is alive and can handle the project
   */
  isServerAlive(languageId: string, path: string): boolean {
    const project = this.projectId.get(languageId);
    if (project && this.connections.has(project)) {
      const config = this.config.getServerConfig(languageId);
      const projectConfig = config.projects.find(id => id.name === project);
      return projectConfig ? path.startsWith(projectConfig.path) : false;
    }
    return false;
  }

  /**
   * Checks if a specific language server is currently running
   * 
   * @param {string} languageId - Language identifier
   * @returns {boolean} True if server is running
   */
  isServerRunning(languageId: string): boolean {
    const project = this.projectId.get(languageId);
    return project ? this.connections.has(project) : false;
  }

  /**
   * Loads files for a specific project into the language server
   * 
   * @param {string} languageId - Language identifier
   * @param {string} project - Project name to load
   * @param {number} timeout - Optional timeout in milliseconds
   * @returns {Promise<ServerResponse>} Promise that resolves with standardized response
   */
  async loadProjectFiles(languageId: string, project: string, timeout?: number): Promise<ServerResponse> {
    const timer = Date.now();
    const serverConfig = this.config.getServerConfig(languageId);
    if (!serverConfig.command) {
      return this.response(`Language server '${languageId}' is not configured.`);
    }
    const projectConfig = serverConfig.projects.find(id => id.name === project);
    if (!projectConfig) {
      return this.response(`Project '${project}' not found in '${languageId}' language server configuration.`);
    }
    if (!this.connections.has(project)) {
      return this.response(`Language server '${languageId}' is not started for '${project}' project.`);
    }
    let cachedFiles = this.projectFiles.get(project);
    let projectFiles = cachedFiles?.get(project);
    if (!projectFiles) {
      await this.setFilesCache(project, projectConfig, serverConfig.extensions);
      cachedFiles = this.projectFiles.get(project)!;
      projectFiles = cachedFiles.get(project);
    }
    if (!projectFiles) {
      return this.response(`Files not found for '${project}' project in '${languageId}' language server.`);
    }
    const unopenedFiles = projectFiles.filter(file => {
      const uri = pathToFileURL(file).toString();
      return !this.openedFiles.get(project)?.has(uri);
    });
    if (unopenedFiles.length) {
      if (timeout) {
        const word = unopenedFiles.length === 1 ? 'file' : 'files';
        const message = `Timeout loading ${unopenedFiles.length} ${word} after ${timeout}ms for '${project}' project in '${languageId}' language server`;
        const timeoutPromise = new Promise<void>((_, reject) => setTimeout(() => reject(`${message}.`), timeout));
        try {
          await Promise.race([this.openFiles(languageId, project, unopenedFiles), timeoutPromise]);
        } catch (error) {
          this.openFiles(languageId, project, unopenedFiles.slice(0, 10));
          return this.response(`${message}: ${error}`);
        }
      } else {
        await this.openFiles(languageId, project, unopenedFiles);
      }
      const elapsed = Date.now() - timer;
      const word = unopenedFiles.length === 1 ? 'file' : 'files';
      return this.response(`Successfully loaded ${unopenedFiles.length} ${word} after ${elapsed}ms for '${project}' project in '${languageId}' language server.`);
    }
    const elapsed = Date.now() - timer;
    const word = projectFiles.length === 1 ? 'file' : 'files';
    return this.response(`Successfully loaded ${projectFiles.length} ${word} after ${elapsed}ms for '${project}' project in '${languageId}' language server.`);
  }

  /**
   * Creates a standardized response for tool execution
   * 
   * @param {unknown} response - The response data from language server
   * @param {boolean} stringify - Whether to JSON stringify the response (default: false)
   * @returns {ServerResponse} Standardized response format
   */
  response(response: unknown, stringify: boolean = false): ServerResponse {
    const text = typeof response === 'string' && !stringify ? response : JSON.stringify(response);
    return { content: [{ type: 'text', text }] };
  }

  /**
   * Restarts a specific language server
   * 
   * @param {string} languageId - Language identifier
   * @param {string} project - Project name
   * @returns {Promise<ServerResponse>} Promise that resolves when server is restarted
   */
  async restartServer(languageId: string, project: string): Promise<ServerResponse> {
    if (!this.config.hasServerConfig(languageId)) {
      return this.response(`Language server '${languageId}' is not configured.`);
    }
    if (project) {
      await this.stopServer(project);
      this.initializedProjects.delete(project);
      return await this.startServer(languageId, project);
    } else {
      return this.response(`Language server '${languageId}' with '${project}' project is not running.`);
    }
  }

  /**
   * Sends a typed JSON-RPC notification to an language server
   * 
   * @param {string} project - Project name
   * @param {string} method - Method name from typed notification
   * @param {unknown} params - Method parameters
   */
  sendNotification(project: string, method: string, params: unknown): void {
    const serverConnection = this.connections.get(project);
    if (!serverConnection || !serverConnection.process.stdin) {
      return;
    }
    serverConnection.connection.sendNotification(method, params);
  }

  /**
   * Sends a typed JSON-RPC request to an language server
   * 
   * @param {string} languageId - Language identifier
   * @param {string} project - Project name
   * @param {string} method - Method name from typed request
   * @param {unknown} params - Method parameters
   * @returns {Promise<unknown>} Promise that resolves with the response
   */
  async sendRequest(languageId: string, project: string, method: string, params: unknown): Promise<unknown> {
    if (!this.checkRateLimit(languageId)) {
      return this.response(`Rate limit exceeded for '${languageId}' language server.`);
    }
    const serverConnection = this.connections.get(project);
    if (!serverConnection || !serverConnection.process.stdin) {
      return this.response(`Language server '${project}' is not running.`);
    }
    if (method === WorkspaceSymbolRequest.method) {
      await this.initializeProject(languageId, project);
    }
    try {
      return await serverConnection.connection.sendRequest(method, params);
    } catch (error) {
      return this.response(`Request failed for '${method}' method: ${error}`);
    }
  }

  /**
   * Sends a file request to the appropriate language server
   * 
   * @param {string} file - Path to the file
   * @param {string} method - Method name from typed request
   * @param {unknown} params - Method parameters
   * @returns {Promise<unknown>} Promise that resolves with the response
   */
  async sendServerRequest(file: string, method: string, params: unknown): Promise<unknown> {
    const project = this.getServerInfo(file);
    if (!project) {
      if (this.connections.size === 0) {
        return 'No language servers are currently running.';
      }
      return `File '${file}' does not belong to running language server.`;
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
      for (const [languageId, runningProject] of this.projectId.entries()) {
        if (runningProject === project) {
          const cachedFiles = this.projectFiles.get(project);
          if (cachedFiles) {
            const projectFiles = cachedFiles.get(project);
            if (projectFiles) {
              await this.openFiles(languageId, project, projectFiles);
            }
          }
          return this.sendRequest(languageId, project, method, params);
        }
      }
    }
    for (const [languageId, runningProject] of this.projectId.entries()) {
      if (runningProject === project) {
        return this.sendRequest(languageId, project, method, params);
      }
    }
    return 'Language server not found for file.';
  }

  /**
   * Gracefully shuts down all language servers
   * 
   * @returns {Promise<void>} Promise that resolves when all servers are stopped
   */
  async shutdown(): Promise<void> {
    const shutdown = Array.from(this.connections.keys()).map(project => {
      return this.stopServer(project);
    });
    await Promise.allSettled(shutdown);
  }

  /**
   * Starts a language server for a specific language
   * 
   * @param {string} languageId - Language identifier
   * @param {string} project - Optional project name to start, defaults to first project
   * @returns {Promise<ServerResponse>} Promise that resolves when server is started
   */
  async startServer(languageId: string, project?: string): Promise<ServerResponse> {
    const serverConfig = this.config.getServerConfig(languageId);
    if (!serverConfig.command) {
      return this.response(`Language server '${languageId}' is not configured.`);
    }
    const selectedProject = project
      ? serverConfig.projects.find(id => id.name === project)
      : serverConfig.projects[0];
    if (!selectedProject) {
      return this.response(`Project '${project}' not found in '${languageId}' language server configuration.`);
    }
    if (this.connections.has(selectedProject.name)) {
      return this.response(`Language server '${languageId}' with '${selectedProject.name}' project is already running.`);
    }
    try {
      const childProcess = spawn(serverConfig.command, serverConfig.args, {
        cwd: selectedProject.path,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      if (!childProcess.stdout || !childProcess.stdin || !childProcess.stderr) {
        return this.response(`Failed to create stdio pipes for '${languageId}' language server.`);
      }
      const connection = this.createConnection(languageId, childProcess);
      const serverConnection: ServerConnection = {
        connection,
        initialized: false,
        process: childProcess,
        name: selectedProject.name
      };
      this.projectId.set(languageId, selectedProject.name);
      this.connections.set(selectedProject.name, serverConnection);
      this.serverStartTimes.set(selectedProject.name, Date.now());
      this.setProcessHandlers(selectedProject.name, childProcess);
      await this.initializeServer(languageId, selectedProject.name);
      return this.response(`Successfully started '${languageId}' language server with '${selectedProject.name}' project.`);
    } catch (error) {
      return this.response(`Failed to start '${languageId}' language server: ${error}`);
    }
  }

  /**
   * Stops a specific language server process
   * 
   * @param {string} project - Project name
   * @returns {Promise<void>} Promise that resolves when server is stopped
   */
  async stopServer(project: string): Promise<void> {
    const serverConnection = this.connections.get(project);
    if (!serverConnection) {
      return;
    }
    for (const [languageId, projectName] of this.projectId.entries()) {
      if (projectName === project) {
        const serverConfig = this.config.getServerConfig(languageId);
        await serverConnection.connection.sendRequest(ShutdownRequest.method, {});
        await new Promise(resolve => setTimeout(resolve, serverConfig.settings.shutdownGracePeriodMs));
        break;
      }
    }
    this.connections.delete(project);
    this.openedFiles.delete(project);
    this.projectFiles.delete(project);
    for (const [languageId, projectName] of this.projectId.entries()) {
      if (projectName === project) {
        this.projectId.delete(languageId);
        break;
      }
    }
    this.serverStartTimes.delete(project);
    for (const [filePath, cachedProject] of this.languageIdCache.entries()) {
      if (cachedProject === project) {
        this.languageIdCache.delete(filePath);
      }
    }
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
    if (!serverConnection.process.killed) {
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
      const packageJson = JSON.parse(this.readFileSync(packagePath, 'utf8'));
      return packageJson.version;
    } catch (error) {
      return `Failed to read package.json version. ${error}`;
    }
  }
}
