/**
 * Process Manager and Communication Client
 * 
 * @module server/client
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { deepmerge } from 'deepmerge-ts';
import fg from 'fast-glob';
import gracefulFs from 'graceful-fs';
import { ChildProcess, spawn } from 'node:child_process';
import { dirname, isAbsolute, join } from 'node:path';
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

/**
 * Standardized response format for MCP tool execution
 * 
 * @interface Response
 * @property {Array<{type: 'text', text: string}>} content - Response content array with text type
 * @property {unknown} [data] - Optional structured data payload
 */
export type Response = {
  content: Array<{ type: 'text'; text: string }>;
  data?: unknown;
};

/**
 * Language server connection state and metadata
 * 
 * @interface ServerConnection
 * @property {ServerCapabilities} [capabilities] - LSP server capabilities after initialization
 * @property {MessageConnection} connection - JSON-RPC message connection
 * @property {boolean} initialized - Whether server completed initialization sequence
 * @property {string} name - Project name associated with this server connection
 * @property {ChildProcess} process - Node.js child process running the language server
 */
interface ServerConnection {
  capabilities?: ServerCapabilities;
  connection: MessageConnection;
  initialized: boolean;
  name: string;
  process: ChildProcess;
}

/**
 * Process Manager and Communication Client
 * 
 * Provides LSP server process management, JSON-RPC communication,
 * and file synchronization with proper lifecycle management.
 * 
 * @class Client
 */
export class Client {
  private config: Config;
  private connections: Map<string, ServerConnection> = new Map();
  private initializedProjects: Set<string> = new Set();
  private openedFiles: Map<string, Set<string>> = new Map();
  private projectFiles: Map<string, string[]> = new Map();
  private projectId: Map<string, string> = new Map();
  private projectPath: Map<string, string> = new Map();
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
   * Checks and enforces rate limiting per language server
   * 
   * Uses sliding window rate limiting based on server configuration.
   * Cleans up expired rate limit entries automatically.
   * 
   * @private
   * @param {string} languageId - Language identifier
   * @returns {boolean} True if within rate limit, false if limit exceeded
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
   * Creates a JSON-RPC message connection for a language server process
   * 
   * Sets up bidirectional communication using stdio streams and configures
   * request handlers based on server settings (configuration, messages, registration).
   * 
   * @private
   * @param {string} languageId - Language identifier for configuration lookup
   * @param {ChildProcess} process - Language server child process with stdio pipes
   * @returns {MessageConnection} Configured JSON-RPC message connection
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
   * Finds all files with specified extensions using fast-glob
   * 
   * Excludes common build/dependency directories by default.
   * Supports custom include/exclude patterns from project configuration.
   * 
   * @private
   * @param {string} cwd - Directory to search from
   * @param {string[]} extensions - File extensions to match (e.g., ['.ts', '.js'])
   * @param {ProjectConfig['patterns']} [patterns] - Optional include/exclude pattern configuration
   * @returns {Promise<string[]>} Array of absolute file paths matching criteria
   */
  private async findFiles(cwd: string, extensions: string[], patterns: ProjectConfig['patterns'] = {}): Promise<string[]> {
    if (extensions.length === 0) {
      return [];
    }
    const excludes = [
      'bin', 'build', 'cache', 'coverage', 'dist', 'log', 'node_modules', 'obj', 'out', 'target', 'temp', 'tmp', 'venv'
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
   * Gets the language ID for a specific project name
   * 
   * @private
   * @param {string} project - Project name
   * @returns {string | undefined} Language identifier for the project, or undefined if not found
   */
  private getLanguageId(project: string): string | undefined {
    for (const [languageId, projectName] of this.projectId.entries()) {
      if (projectName === project) {
        return languageId;
      }
    }
    return undefined;
  }

  /**
   * Gets server information for a specific file path using caching and extension matching
   * 
   * Converts relative paths to absolute, checks cache first for performance,
   * then searches through running servers to find project ownership based on
   * path prefixes and file extension compatibility.
   * 
   * @private
   * @param {string} filePath - Absolute or relative path to the file
   * @returns {string | null} Project name of the running server that handles the file, or null if no match
   */
  private getServerInfo(filePath: string): string | null {
    const absolutePath = isAbsolute(filePath) ? filePath : join(process.cwd(), filePath);
    const cachedProject = this.projectPath.get(absolutePath);
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
                this.projectPath.set(absolutePath, project);
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
   * Initializes project workspace by configuring workspace folders
   * 
   * Sends DidChangeWorkspaceFoldersNotification to inform language server
   * about workspace structure. Prevents duplicate initialization using cache.
   * 
   * @private
   * @param {string} languageId - Language identifier for server configuration lookup
   * @param {string} project - Project name to initialize workspace for
   * @returns {Promise<void>} Promise that resolves when workspace folders are configured
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
  }

  /**
   * Initializes language server using LSP initialization protocol
   * 
   * Sends InitializeRequest with client capabilities, workspace folders, and configuration.
   * Establishes server capabilities, opens initial file for indexing, and validates
   * server readiness through workspace symbol query or configuration-based check.
   * 
   * @private
   * @param {string} languageId - Language identifier for configuration and capability setup
   * @param {string} project - Project name for workspace and connection management
   * @returns {Promise<void>} Promise that resolves when LSP initialization sequence completes
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
    const projectFiles = this.projectFiles.get(project);
    if (projectFiles && projectFiles.length) {
      await this.openFile(languageId, project, projectFiles[0]);
    }
    try {
      if (projectFiles && projectFiles.length && serverConfig.settings.workspace === false) {
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
   * Opens a single file in the language server using DidOpenTextDocument notification
   * 
   * Converts file path to URI, reads file content, and tracks opened files per project.
   * Skips files already opened to avoid duplicate notifications.
   * 
   * @private
   * @param {string} languageId - Language identifier for TextDocumentItem creation
   * @param {string} project - Project name for file tracking and connection lookup
   * @param {string} filePath - Absolute file path to read and open
   * @returns {Promise<Response | null>} Error response if file read fails, null on successful open
   */
  private async openFile(languageId: string, project: string, filePath: string): Promise<Response | null> {
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
   * Opens multiple files in the language server with concurrency control
   * 
   * Uses p-limit for controlled concurrency based on server settings.
   * Implements timeout handling with fallback to first 10 files on timeout.
   * 
   * @private
   * @param {string} languageId - Language identifier for configuration lookup
   * @param {string} project - Project name for file tracking
   * @param {string[]} files - Array of absolute file paths to open
   * @param {number} [timeout] - Optional timeout in milliseconds for operation
   * @returns {Promise<void>} Promise that resolves when all files are opened or timeout occurs
   * @throws {Error} When timeout occurs during file loading
   */
  private async openFiles(languageId: string, project: string, files: string[], timeout?: number): Promise<void> {
    if (files.length === 0) {
      return;
    }
    const serverConfig = this.config.getServerConfig(languageId);
    const fileReadLimit = pLimit(serverConfig.settings.maxConcurrentFileReads);
    const openFiles = files.map(file =>
      fileReadLimit(() => this.openFile(languageId, project, file))
    );
    if (timeout) {
      try {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), timeout);
        await Promise.race([
          Promise.allSettled(openFiles),
          new Promise<void>((_, reject) => {
            abortController.signal.addEventListener('abort', () => reject(new Error('Timeout')));
          })
        ]);
        clearTimeout(timeoutId);
      } catch (error) {
        const fallbackFiles = files.slice(0, Math.min(10, files.length));
        const fallbackPromises = fallbackFiles.map(file =>
          fileReadLimit(() => this.openFile(languageId, project, file))
        );
        await Promise.allSettled(fallbackPromises);
        throw error;
      }
    } else {
      await Promise.allSettled(openFiles);
    }
  }

  /**
   * Sets comprehensive LSP client capabilities for initialization
   * 
   * Configures support for all major LSP features including completion,
   * hover, definition, references, formatting, and workspace operations.
   * Merges with server-specific capability overrides from configuration.
   * 
   * @private
   * @param {string} languageId - Language identifier for server-specific capability overrides
   * @returns {ClientCapabilities} Complete LSP client capabilities object
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
   * Sets files cache for a specific project using glob pattern matching
   * 
   * Discovers all files matching configured extensions within project path,
   * populates language ID cache for file-to-project mapping, and stores
   * file lists for efficient project file management.
   * 
   * @private
   * @param {string} project - Project name for cache key
   * @param {ProjectConfig} projectConfig - Project configuration with path and patterns
   * @param {string[]} extensions - File extensions to match during discovery
   * @returns {Promise<void>} Promise that resolves when file discovery and caching complete
   */
  private async setFilesCache(project: string, projectConfig: ProjectConfig, extensions: string[]): Promise<void> {
    const files = await this.findFiles(projectConfig.path, extensions, projectConfig.patterns);
    if (files.length) {
      files.forEach(filePath => {
        this.projectPath.set(filePath, project);
      });
      this.projectFiles.set(project, files);
    }
  }

  /**
   * Sets process event handlers for language server lifecycle management
   * 
   * Configures cleanup handlers for process termination that remove project mappings,
   * clear file caches, close connections, and clean up tracking data structures
   * to prevent memory leaks and stale references.
   * 
   * @private
   * @param {string} project - Project name for cleanup scope identification
   * @param {ChildProcess} process - Language server process to monitor for lifecycle events
   */
  private setProcessHandlers(project: string, process: ChildProcess): void {
    const cleanup = () => {
      for (const [languageId, projectName] of this.projectId.entries()) {
        if (projectName === project) {
          this.projectId.delete(languageId);
          break;
        }
      }
      for (const [filePath, cachedProject] of this.projectPath.entries()) {
        if (cachedProject === project) {
          this.projectPath.delete(filePath);
        }
      }
      this.connections.delete(project);
      this.openedFiles.delete(project);
      this.projectFiles.delete(project);
      this.serverStartTimes.delete(project);
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
   * Gets the cached project files for a specific project
   * 
   * @param {string} languageId - Language identifier
   * @param {string} project - Project name
   * @returns {Promise<string[] | null>} Promise that resolves with array of file paths or null if not found
   */
  async getProjectFiles(languageId: string, project: string): Promise<string[] | null> {
    if (!this.config.hasServerConfig(languageId)) {
      return null;
    }
    const serverConfig = this.config.getServerConfig(languageId);
    const projectConfig = serverConfig.projects.find(id => id.name === project);
    if (!projectConfig) {
      return null;
    }
    let projectFiles = this.projectFiles.get(project);
    if (!projectFiles) {
      await this.setFilesCache(project, projectConfig, serverConfig.extensions);
      projectFiles = this.projectFiles.get(project);
    }
    return projectFiles || null;
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
      const timer = this.serverStartTimes.get(project);
      if (timer) {
        return Date.now() - timer;
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
   * Loads all project files into the language server for workspace analysis
   * 
   * Opens all cached project files that haven't been opened yet.
   * Supports optional timeout with fallback behavior for large projects.
   * 
   * @param {string} languageId - Language identifier
   * @param {string} project - Project name to load files for
   * @param {number} [timeout] - Optional timeout in milliseconds for file loading
   * @returns {Promise<Response>} Standardized response with loading results and timing
   */
  async loadProjectFiles(languageId: string, project: string, timeout?: number): Promise<Response> {
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
    const projectFiles = await this.getProjectFiles(languageId, project);
    if (!projectFiles) {
      return this.response(`Files not found for '${project}' project in '${languageId}' language server.`);
    }
    if (timeout) {
      try {
        await this.openFiles(languageId, project, projectFiles, timeout);
      } catch (error) {
        const message = `Timeout loading project files for '${project}' project in '${languageId}' language server.`;
        return this.response(message, false, {
          languageId,
          project,
          files: projectFiles.length,
          path: projectConfig.path,
          timeout: `${timeout}ms`
        });
      }
    } else {
      await this.openFiles(languageId, project, projectFiles);
    }
    this.initializedProjects.add(project);
    const elapsed = Date.now() - timer;
    const message = `Successfully loaded project files for '${project}' project in '${languageId}' language server.`;
    return this.response(message, false, {
      languageId,
      project,
      files: projectFiles.length,
      path: projectConfig.path,
      time: `${elapsed}ms`
    });
  }

  /**
   * Creates a standardized MCP response format
   * 
   * Converts language server responses into the MCP-compliant format
   * with optional structured data payload.
   * 
   * @param {unknown} message - Response message (string or object)
   * @param {boolean} [stringify=false] - Whether to JSON stringify non-string messages
   * @param {unknown} [data] - Optional structured data to include in response
   * @returns {Response} MCP-compliant response with content array and optional data
   */
  response(message: unknown, stringify: boolean = false, data?: unknown): Response {
    const text = typeof message === 'string' && !stringify ? message : JSON.stringify(message);
    const result: Response = { content: [{ type: 'text', text }] };
    if (data) {
      result.data = data;
    }
    return result;
  }

  /**
   * Restarts a language server with the same or a different project
   * 
   * @param {string} languageId - Language identifier
   * @param {string} project - Project name to start after stopping
   * @returns {Promise<Response>} Promise that resolves with restart result
   */
  async restartServer(languageId: string, project: string): Promise<Response> {
    if (!this.config.hasServerConfig(languageId)) {
      return this.response(`Language server '${languageId}' is not configured.`);
    }
    if (!this.projectId.has(languageId)) {
      return this.response(`Language server '${languageId}' is not running.`);
    }
    const serverConfig = this.config.getServerConfig(languageId);
    const projectConfig = serverConfig.projects.find(id => id.name === project);
    if (!projectConfig) {
      return this.response(`Project '${project}' not found in '${languageId}' language server configuration.`);
    }
    try {
      const timer = Date.now();
      const runningProject = this.projectId.get(languageId);
      if (runningProject) {
        await this.stopServer(runningProject);
        this.initializedProjects.delete(runningProject);
      }
      const startResponse = await this.startServer(languageId, project);
      const message = `Successfully restarted '${languageId}' language server with '${project}' project.`;
      const responseData = startResponse.data as { path?: string; pid?: number };
      return this.response(message, false, {
        languageId,
        project,
        path: responseData.path,
        pid: responseData.pid,
        time: new Date(timer).toISOString()
      });
    } catch (error) {
      return this.response(`Error restarting '${languageId}' language server: ${error}`);
    }
  }

  /**
   * Sends a typed JSON-RPC notification to a language server
   * 
   * Sends fire-and-forget notifications that don't expect responses.
   * Validates connection state before attempting to send.
   * 
   * @param {string} project - Project name for connection lookup
   * @param {string} method - LSP method name (e.g., 'textDocument/didOpen')
   * @param {unknown} params - Method-specific parameters matching LSP specification
   */
  sendNotification(project: string, method: string, params: unknown): void {
    const serverConnection = this.connections.get(project);
    if (!serverConnection || !serverConnection.process.stdin) {
      return;
    }
    serverConnection.connection.sendNotification(method, params);
  }

  /**
   * Sends a typed JSON-RPC request to a language server with rate limiting
   * 
   * Enforces rate limits, validates connection state, handles workspace initialization
   * for workspace symbol requests, and provides standardized error responses.
   * 
   * @param {string} languageId - Language identifier for rate limiting and configuration
   * @param {string} project - Project name for connection and workspace management
   * @param {string} method - LSP method name (e.g., 'textDocument/completion')
   * @param {unknown} params - Method-specific parameters matching LSP specification
   * @returns {Promise<unknown>} LSP response data or standardized error response
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
   * Sends a file-specific request to the appropriate language server
   * 
   * Determines which language server handles the file, opens all project files
   * for document-level requests to ensure proper indexing, then routes the
   * request to the correct server connection.
   * 
   * @param {string} file - Absolute or relative path to the target file
   * @param {string} method - LSP method name (e.g., 'textDocument/hover')
   * @param {unknown} params - Method-specific parameters with file URI
   * @returns {Promise<unknown>} LSP response data or error message string
   */
  async sendServerRequest(file: string, method: string, params: unknown): Promise<unknown> {
    const project = this.getServerInfo(file);
    if (!project) {
      if (this.connections.size === 0) {
        return 'No language servers are currently running.';
      }
      return `File '${file}' does not belong to running language server.`;
    }
    let languageId: string | undefined;
    for (const [id, projectName] of this.projectId.entries()) {
      if (projectName === project) {
        languageId = id;
        break;
      }
    }
    if (!languageId) {
      return 'Language server not found.';
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
      TypeHierarchySupertypesRequest.method,
      WorkspaceSymbolRequest.method
    ];
    if (methods.includes(method)) {
      if (!this.initializedProjects.has(project)) {
        const projectFiles = this.projectFiles.get(project);
        if (projectFiles) {
          await this.openFiles(languageId, project, projectFiles);
          this.initializedProjects.add(project);
        }
      }
      return this.sendRequest(languageId, project, method, params);
    }
    return this.sendRequest(languageId, project, method, params);
  }

  /**
   * Gracefully shuts down all running language servers
   * 
   * Stops all server connections concurrently, allowing each to complete
   * its shutdown sequence including LSP shutdown requests and process cleanup.
   * 
   * @returns {Promise<void>} Promise that resolves when all server shutdowns complete or fail
   */
  async shutdown(): Promise<void> {
    const shutdown = Array.from(this.connections.keys()).map(project => {
      return this.stopServer(project);
    });
    await Promise.allSettled(shutdown);
  }

  /**
   * Starts a language server process for a specific language and project
   * 
   * Spawns child process, creates JSON-RPC connection, initializes LSP protocol,
   * sets up file caching, and configures process lifecycle handlers.
   * Prevents duplicate server instances for the same language.
   * 
   * @param {string} languageId - Language identifier for server configuration lookup
   * @param {string} [project] - Optional project name to start, defaults to first configured project
   * @returns {Promise<Response>} Standardized response with server startup details and timing
   */
  async startServer(languageId: string, project?: string): Promise<Response> {
    const serverConfig = this.config.getServerConfig(languageId);
    if (!serverConfig.command) {
      return this.response(`Language server '${languageId}' is not configured.`);
    }
    const selectedProject = project ? serverConfig.projects.find(id => id.name === project) : serverConfig.projects[0];
    if (!selectedProject) {
      return this.response(`Project '${project}' not found in '${languageId}' language server configuration.`);
    }
    if (this.projectId.has(languageId)) {
      const runningProject = this.projectId.get(languageId);
      return this.response(`Language server '${languageId}' with '${runningProject}' project is already running.`);
    }
    try {
      const timer = Date.now();
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
      this.serverStartTimes.set(selectedProject.name, timer);
      this.setProcessHandlers(selectedProject.name, childProcess);
      await this.initializeServer(languageId, selectedProject.name);
      const message = `Successfully started '${languageId}' language server with '${selectedProject.name}' project.`;
      return this.response(message, false, {
        languageId,
        project: selectedProject.name,
        path: selectedProject.path,
        pid: childProcess.pid,
        time: new Date(timer).toISOString()
      });
    } catch (error) {
      return this.response(`Failed to start '${languageId}' language server: ${error}`);
    }
  }

  /**
   * Stops a specific language server process using graceful shutdown sequence
   * 
   * Sends LSP shutdown request, waits for grace period, sends exit notification,
   * disposes connection, terminates process with SIGTERM then SIGKILL if needed,
   * and cleans up all associated tracking data.
   * 
   * @param {string} project - Project name identifying the server connection to stop
   * @returns {Promise<void>} Promise that resolves when complete shutdown and cleanup finish
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
    for (const [languageId, projectName] of this.projectId.entries()) {
      if (projectName === project) {
        this.projectId.delete(languageId);
        break;
      }
    }
    for (const [filePath, cachedProject] of this.projectPath.entries()) {
      if (cachedProject === project) {
        this.projectPath.delete(filePath);
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
    this.connections.delete(project);
    this.openedFiles.delete(project);
    this.projectFiles.delete(project);
    this.serverStartTimes.delete(project);
  }

  /**
   * Gets package version from package.json
   * 
   * Reads version from package.json relative to current module location.
   * Returns error message string if reading fails rather than throwing.
   * 
   * @returns {string} Package version string or error message
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
