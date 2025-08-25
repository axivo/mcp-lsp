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
  connection: MessageConnection;
  process: ChildProcess;
  initialized: boolean;
  projectName: string;
}

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
  private readonly fileReadLimit = pLimit(10);
  private readonly readFileAsync = promisify(gracefulFs.readFile);
  private readonly readFileSync = gracefulFs.readFileSync;
  private readonly IGNORE = [
    'bin', 'build', 'cache', 'coverage', 'dist', 'log', 'node_modules', 'obj', 'out', 'target', 'temp', 'tmp'
  ];
  private readonly RATE_LIMIT_MAX_REQUESTS = 100;
  private readonly RATE_LIMIT_WINDOW = 60000;

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
    const serverConfig = this.config.getServerConfig(languageId);
    if (serverConfig.settings.message === false) {
      connection.onRequest(ShowMessageRequest.method, (params: any) => {
        return null;
      });
    }
    if (serverConfig.settings.registration === false) {
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
  * Finds all files with specified extensions using fast glob search
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
    const allPatterns = [extensions.length === 1 ? `**/*${extensions[0]}` : `**/*{${extensions.join(',')}}`];
    if (patterns?.include) {
      allPatterns.push(...patterns.include);
    }
    const ignore = ['**/.*', ...this.IGNORE.map(pattern => `**/${pattern}`)];
    if (patterns?.exclude) {
      ignore.push(...patterns.exclude);
    }
    return await fg(allPatterns, {
      absolute: true,
      cwd,
      ignore,
      onlyFiles: true
    });
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
    for (const [project, serverConnection] of this.connections) {
      for (const [languageId, runningProject] of this.projectId.entries()) {
        if (runningProject === project) {
          const serverConfig = this.config.getServerConfig(languageId);
          const projectConfig = serverConfig.projects.find(p => p.name === project);
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
    const projectConfig = serverConfig.projects.find(p => p.name === project)!;
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
    const projectConfig = serverConfig.projects.find(p => p.name === project)!;
    const workspaceFolders: WorkspaceFolder[] = [{
      name: projectConfig.name,
      uri: pathToFileURL(projectConfig.path).toString()
    }];
    const initParams: InitializeParams = {
      capabilities: this.setClientCapabilities(),
      clientInfo: {
        name: 'mcp-lsp-client',
        version: this.version(),
      },
      initializationOptions: serverConfig.configuration ? { [languageId]: serverConfig.configuration } : {},
      processId: process.pid,
      rootPath: projectConfig.path,
      rootUri: pathToFileURL(projectConfig.path).toString(),
      workspaceFolders
    };
    await serverConnection.connection.sendRequest(InitializeRequest.method, initParams);
    serverConnection.connection.sendNotification(InitializedNotification.method, {});
    await this.setFilesCache(languageId, project, projectConfig, serverConfig.extensions);
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
   * @returns {Promise<void>} Promise that resolves when file is opened
   */
  private async openFile(languageId: string, project: string, filePath: string): Promise<void> {
    const uri = pathToFileURL(filePath).toString();
    let openedSet = this.openedFiles.get(project);
    if (!openedSet) {
      openedSet = new Set<string>();
      this.openedFiles.set(project, openedSet);
    }
    if (openedSet.has(uri)) {
      return;
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
    const openFiles = files.map(file =>
      this.fileReadLimit(() => this.openFile(languageId, project, file))
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
      general: { positionEncodings: ['utf-16', 'utf-8'] },
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
            resolveSupport: { properties: ['additionalTextEdits', 'documentation', 'detail'] },
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
  }

  /**
   * Sets files cache for a specific project
   * 
   * @private
   * @param {string} languageId - Language identifier
   * @param {string} project - Project name
   * @param {ProjectConfig} projectConfig - Project configuration object
   * @param {string[]} extensions - File extensions
   * @returns {Promise<void>} Promise that resolves when files are cached
   */
  private async setFilesCache(languageId: string, project: string, projectConfig: any, extensions: string[]): Promise<void> {
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
   * @param {string} languageId - Language identifier
   * @param {string} project - Project name
   * @param {ChildProcess} process - Language server process
   */
  private setProcessHandlers(languageId: string, project: string, process: ChildProcess): void {
    process.on('error', (error) => {
      this.connections.delete(project);
      this.serverStartTimes.delete(project);
    });
    process.on('exit', (code, signal) => {
      this.connections.delete(project);
      this.serverStartTimes.delete(project);
    });
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
   * @param {string} projectPath - Project path to validate against server configuration
   * @returns {boolean} True if server is alive and can handle the project
   */
  isServerAlive(languageId: string, projectPath: string): boolean {
    const project = this.projectId.get(languageId);
    if (project && this.connections.has(project)) {
      const config = this.config.getServerConfig(languageId);
      const projectConfig = config.projects.find(p => p.name === project);
      return projectConfig ? projectPath.startsWith(projectConfig.path) : false;
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
   * @param {string} projectName - Project name to load
   * @param {number} timeout - Optional timeout in milliseconds
   * @returns {Promise<any>} Promise that resolves with standardized response
   */
  async loadProjectFiles(languageId: string, projectName: string, timeout?: number): Promise<any> {
    const serverConfig = this.config.getServerConfig(languageId);
    if (!serverConfig.command) {
      return this.response(`Language server '${languageId}' is not configured.`);
    }
    const projectConfig = serverConfig.projects.find(project => project.name === projectName);
    if (!projectConfig) {
      return this.response(`Project '${projectName}' not found in '${languageId}' server configuration.`);
    }
    if (!this.connections.has(projectName)) {
      return this.response(`Language server '${languageId}' for project '${projectName}' is not running.`);
    }
    let cachedFiles = this.projectFiles.get(projectName);
    let projectFiles = cachedFiles?.get(projectName);
    if (!projectFiles) {
      await this.setFilesCache(languageId, projectName, projectConfig, serverConfig.extensions);
      cachedFiles = this.projectFiles.get(projectName)!;
      projectFiles = cachedFiles.get(projectName);
    }
    if (!projectFiles) {
      return this.response(`No files found for project '${projectName}' in '${languageId}' language server.`);
    }
    const openedSet = this.openedFiles.get(projectName) || new Set();
    const unopenedFiles = projectFiles.filter(file => {
      const uri = pathToFileURL(file).toString();
      return !openedSet.has(uri);
    });
    if (unopenedFiles.length) {
      if (timeout) {
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(`Timeout after ${timeout}ms loading ${unopenedFiles.length} files.`), timeout)
        );
        try {
          await Promise.race([
            this.openFiles(languageId, projectName, unopenedFiles),
            timeoutPromise
          ]);
        } catch (error) {
          this.openFiles(languageId, projectName, unopenedFiles.slice(0, 10));
          return this.response(`Timeout loading '${projectName}' project files: ${error}`);
        }
      } else {
        await this.openFiles(languageId, projectName, unopenedFiles);
      }
    }
    return this.response(`Successfully loaded all '${projectName}' project files.`);
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
   * @param {string} project - Optional project name to restart
   * @returns {Promise<void>} Promise that resolves when server is restarted
   */
  async restartServer(languageId: string, project?: string): Promise<void> {
    if (!this.config.hasServerConfig(languageId)) {
      return this.response(`Language server '${languageId}' is unknown.`);
    }
    if (project) {
      const currentProject = this.projectId.get(languageId);
      if (currentProject) {
        await this.stopServer(languageId, currentProject);
        this.initializedProjects.delete(currentProject);
      }
      await this.startServer(languageId, project);
    } else {
      const currentProject = this.projectId.get(languageId);
      if (currentProject) {
        await this.stopServer(languageId, currentProject);
        this.initializedProjects.delete(currentProject);
        await this.startServer(languageId, currentProject);
      }
    }
  }

  /**
   * Sends a typed JSON-RPC notification to an language server
   * 
   * @param {string} project - Project name
   * @param {string} method - Method name from typed notification
   * @param {any} params - Method parameters
   */
  sendNotification(project: string, method: string, params: any): void {
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
   * @param {any} params - Method parameters
   * @returns {Promise<any>} Promise that resolves with the response
   */
  async sendRequest(languageId: string, project: string, method: string, params: any): Promise<any> {
    this.checkRateLimit(languageId);
    const serverConnection = this.connections.get(project);
    if (!serverConnection || !serverConnection.process.stdin) {
      return this.response(`Language server '${project}' is not running.`);
    }
    if (method === WorkspaceSymbolRequest.method) {
      await this.initializeProject(languageId, project);
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
      const absolutePath = file.startsWith('/') ? file : join(process.cwd(), file);
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
    const shutdownPromises = Array.from(this.projectId.entries()).map(([languageId, project]) => {
      return this.stopServer(languageId, project);
    });
    await Promise.allSettled(shutdownPromises);
  }

  /**
   * Starts a language server for a specific language
   * 
   * @param {string} languageId - Language identifier
   * @param {string} projectName - Optional project name to start (defaults to first project)
   * @returns {Promise<void>} Promise that resolves when server is started
   */
  async startServer(languageId: string, projectName?: string): Promise<void> {
    const serverConfig = this.config.getServerConfig(languageId);
    if (!serverConfig.command) {
      return this.response(`Language server '${languageId}' is not configured.`);
    }
    const selectedProject = projectName ?
      serverConfig.projects.find(p => p.name === projectName) :
      serverConfig.projects[0];
    if (!selectedProject) {
      return this.response(`Project '${projectName || 'default'}' not found for language '${languageId}'.`);
    }
    if (this.connections.has(selectedProject.name)) {
      return this.response(`Language server for project '${selectedProject.name}' is already running.`);
    }
    try {
      const childProcess = spawn(serverConfig.command, serverConfig.args, {
        cwd: selectedProject.path,
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
        process: childProcess,
        projectName: selectedProject.name
      };
      this.projectId.set(languageId, selectedProject.name);
      this.connections.set(selectedProject.name, serverConnection);
      this.serverStartTimes.set(selectedProject.name, Date.now());
      this.setProcessHandlers(languageId, selectedProject.name, childProcess);
      await this.initializeServer(languageId, selectedProject.name);
    } catch (error) {
      return this.response(`Failed to start '${languageId}' language server: ${error}`);
    }
  }

  /**
   * Stops a specific language server process
   * 
   * @param {string} languageId - Language identifier
   * @param {string} project - Project name
   * @returns {Promise<void>} Promise that resolves when server is stopped
   */
  async stopServer(languageId: string, project: string): Promise<void> {
    const serverConnection = this.connections.get(project);
    if (!serverConnection) {
      return;
    }
    this.connections.delete(project);
    this.openedFiles.delete(project);
    this.projectFiles.delete(project);
    this.projectId.delete(project);
    this.serverStartTimes.delete(project);
    for (const [filePath, cachedProject] of this.languageIdCache.entries()) {
      if (cachedProject === project) {
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
