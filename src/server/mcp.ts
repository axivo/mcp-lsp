/**
 * LSP MCP Server implementation
 * 
 * @module server/mcp
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import {
  CodeActionParams,
  CodeActionRequest,
  CompletionRequest,
  DefinitionRequest,
  DocumentSymbolRequest,
  HoverRequest,
  ReferenceParams,
  ReferencesRequest,
  TextDocumentPositionParams,
  TypeDefinitionRequest,
  WorkspaceSymbolParams,
  WorkspaceSymbolRequest
} from 'vscode-languageserver-protocol';
import { LspClient } from "./client.js";
import { LspConfigParser } from "./config.js";

interface GetCodeActionsArgs {
  character: number;
  file_path: string;
  line: number;
}

interface GetCompletionsArgs {
  character: number;
  file_path: string;
  line: number;
}

interface GetDocumentSymbolsArgs {
  file_path: string;
}

interface GetHoverArgs {
  character: number;
  file_path: string;
  line: number;
}

interface GetServerProjectsArgs {
  language_id: string;
}

interface GetServerStatusArgs {
  language_id: string;
}

interface GetSymbolArgs {
  character: number;
  file_path: string;
  line: number;
}

interface GetSymbolReferencesArgs {
  character: number;
  file_path: string;
  line: number;
  include_declaration?: boolean;
}

interface GetSymbolsArgs {
  project_name: string;
  query: string;
}

interface GetTypeDefinitionsArgs {
  character: number;
  file_path: string;
  line: number;
}

interface RestartServerArgs {
  language_id: string;
}

interface StartServerArgs {
  language_id: string;
}

interface StopServerArgs {
  language_id: string;
}

type ToolHandler = (args: any) => Promise<any>;

/**
 * LSP MCP Server implementation
 * 
 * @class LspMcpServer
 */
export class LspMcpServer {
  private client: LspClient;
  private config: LspConfigParser;
  private server: Server;
  private toolHandlers: Map<string, ToolHandler>;
  private transport?: StdioServerTransport;

  /**
   * Creates a new LspMcpServer instance
   * 
   * @param {string} configPath - Path to the LSP configuration file
   */
  constructor(configPath: string) {
    this.client = new LspClient(configPath);
    this.config = new LspConfigParser(configPath);
    this.server = new Server(
      { name: 'language-server', version: this.client.version() },
      { capabilities: { tools: {} } }
    );
    this.toolHandlers = new Map<string, ToolHandler>();
    this.setupToolHandlers();
    this.setupHandlers();
  }

  /**
   * Returns all available LSP tools
   * 
   * @private
   * @returns {Tool[]} Array of LSP tool definitions
   */
  private getLspTools(): Tool[] {
    return [
      this.getCodeActionsTool(),
      this.getCompletionsTool(),
      this.getDocumentSymbolsTool(),
      this.getHoverTool(),
      this.getServerProjectsTool(),
      this.getServerStatusTool(),
      this.getSymbolDefinitionsTool(),
      this.getSymbolReferencesTool(),
      this.getSymbolsTool(),
      this.getTypeDefinitionsTool(),
      this.restartServerTool(),
      this.startServerTool(),
      this.stopServerTool()
    ];
  }

  /**
   * Tool definition for getting code actions
   * 
   * @private
   * @returns {Tool} Code actions tool
   */
  private getCodeActionsTool(): Tool {
    return {
      name: 'get_code_actions',
      description: 'Get quick fixes and refactoring suggestions at a specific position',
      inputSchema: {
        type: 'object',
        properties: {
          character: { type: 'number', description: 'Character position (zero-based)' },
          file_path: { type: 'string', description: 'Path to the project file' },
          line: { type: 'number', description: 'Line number (zero-based)' }
        },
        required: ['character', 'file_path', 'line']
      }
    };
  }

  /**
   * Tool definition for getting code completions
   * 
   * @private
   * @returns {Tool} Code completions tool
   */
  private getCompletionsTool(): Tool {
    return {
      name: 'get_completions',
      description: 'Get code completion suggestions at a specific position',
      inputSchema: {
        type: 'object',
        properties: {
          character: { type: 'number', description: 'Character position (zero-based)' },
          file_path: { type: 'string', description: 'Path to the project file' },
          line: { type: 'number', description: 'Line number (zero-based)' }
        },
        required: ['character', 'file_path', 'line']
      }
    };
  }

  /**
   * Tool definition for getting document symbols
   * 
   * @private
   * @returns {Tool} Document symbols tool
   */
  private getDocumentSymbolsTool(): Tool {
    return {
      name: 'get_document_symbols',
      description: 'Get symbols across entire document',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the project file' }
        },
        required: ['file_path']
      }
    };
  }

  /**
   * Tool definition for getting hover information
   * 
   * @private
   * @returns {Tool} Hover information tool
   */
  private getHoverTool(): Tool {
    return {
      name: 'get_hover',
      description: 'Get hover information and documentation at a specific position',
      inputSchema: {
        type: 'object',
        properties: {
          character: { type: 'number', description: 'Character position (zero-based)' },
          file_path: { type: 'string', description: 'Path to the project file' },
          line: { type: 'number', description: 'Line number (zero-based)' }
        },
        required: ['character', 'file_path', 'line']
      }
    };
  }

  /**
   * Tool definition for getting server projects
   * 
   * @private
   * @returns {Tool} Server projects tool
   */
  private getServerProjectsTool(): Tool {
    return {
      name: 'get_server_projects',
      description: 'Get available projects for a specific language server',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Language identifier (e.g., python, typescript)' }
        },
        required: ['language_id']
      }
    };
  }

  /**
   * Tool definition for getting language server status
   * 
   * @private
   * @returns {Tool} Server status tool
   */
  private getServerStatusTool(): Tool {
    return {
      name: 'get_server_status',
      description: 'Get status of a specific language server',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Language identifier (e.g., python, typescript)' }
        },
        required: ['language_id']
      }
    };
  }

  /**
   * Tool definition for getting symbol definition locations
   * 
   * @private
   * @returns {Tool} Symbol definitions tool
   */
  private getSymbolDefinitionsTool(): Tool {
    return {
      name: 'get_symbol_definitions',
      description: 'Get all symbol definition locations',
      inputSchema: {
        type: 'object',
        properties: {
          character: { type: 'number', description: 'Character position (zero-based)' },
          file_path: { type: 'string', description: 'Path to the project file' },
          line: { type: 'number', description: 'Line number (zero-based)' }
        },
        required: ['character', 'file_path', 'line']
      }
    };
  }

  /**
   * Tool definition for getting symbol references
   * 
   * @private
   * @returns {Tool} Symbol references tool
   */
  private getSymbolReferencesTool(): Tool {
    return {
      name: 'get_symbol_references',
      description: 'Get all symbol usage locations',
      inputSchema: {
        type: 'object',
        properties: {
          character: { type: 'number', description: 'Character position (zero-based)' },
          file_path: { type: 'string', description: 'Path to the project file' },
          line: { type: 'number', description: 'Line number (zero-based)' },
          include_declaration: { type: 'boolean', description: 'Include declaration in results', default: true }
        },
        required: ['character', 'file_path', 'line']
      }
    };
  }

  /**
   * Tool definition for workspace symbol search
   * 
   * @private
   * @returns {Tool} Workspace symbols tool
   */
  private getSymbolsTool(): Tool {
    return {
      name: 'get_symbols',
      description: 'Get symbols across entire workspace',
      inputSchema: {
        type: 'object',
        properties: {
          project_name: { type: 'string', description: 'Project name to search within' },
          query: { type: 'string', description: 'Symbol search query' }
        },
        required: ['project_name', 'query']
      }
    };
  }

  /**
   * Tool definition for getting type definitions
   * 
   * @private
   * @returns {Tool} Type definitions tool
   */
  private getTypeDefinitionsTool(): Tool {
    return {
      name: 'get_type_definitions',
      description: 'Get all type definition locations',
      inputSchema: {
        type: 'object',
        properties: {
          character: { type: 'number', description: 'Character position (zero-based)' },
          file_path: { type: 'string', description: 'Path to the project file' },
          line: { type: 'number', description: 'Line number (zero-based)' }
        },
        required: ['character', 'file_path', 'line']
      }
    };
  }

  /**
   * Handles get code actions tool requests
   * 
   * @private
   * @param {GetCodeActionsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetCodeActions(args: GetCodeActionsArgs): Promise<any> {
    if (!args.file_path || args.character === undefined || args.line === undefined) {
      return 'Missing required arguments: character, file_path, and line';
    }
    const params: CodeActionParams = {
      context: { diagnostics: [] },
      range: {
        start: { character: args.character, line: args.line },
        end: { character: args.character, line: args.line }
      },
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, CodeActionRequest.method, params);
    return result;
  }

  /**
   * Handles get completions tool requests
   * 
   * @private
   * @param {GetCompletionsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetCompletions(args: GetCompletionsArgs): Promise<any> {
    if (!args.file_path || args.character === undefined || args.line === undefined) {
      return 'Missing required arguments: character, file_path, and line';
    }
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, CompletionRequest.method, params);
    return result;
  }

  /**
   * Handles get document symbols tool requests
   * 
   * @private
   * @param {GetDocumentSymbolsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetDocumentSymbols(args: GetDocumentSymbolsArgs): Promise<any> {
    if (!args.file_path) {
      return 'Missing required argument: file_path';
    }
    const params = {
      textDocument: {
        uri: `file://${args.file_path}`
      }
    };
    const result = await this.client.sendServerRequest(args.file_path, DocumentSymbolRequest.method, params);
    return result;
  }

  /**
   * Handles get hover tool requests
   * 
   * @private
   * @param {GetHoverArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetHover(args: GetHoverArgs): Promise<any> {
    if (!args.file_path || args.character === undefined || args.line === undefined) {
      return 'Missing required arguments: character, file_path, and line';
    }
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, HoverRequest.method, params);
    return result;
  }

  /**
   * Handles get server projects tool requests
   * 
   * @private
   * @param {GetServerProjectsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetServerProjects(args: GetServerProjectsArgs): Promise<any> {
    if (!args.language_id) {
      return 'Missing required argument: language_id';
    }
    if (!this.config.hasServerConfig(args.language_id)) {
      return `Language server '${args.language_id}' is not configured`;
    }
    if (!this.client.isServerRunning(args.language_id)) {
      return `Language server '${args.language_id}' is not running`;
    }
    const serverConfig = this.config.getServerConfig(args.language_id);
    const projects = Object.entries(serverConfig.projects).map(([name, path]) => ({
      project_name: name,
      path: path,
      extensions: serverConfig.extensions
    }));
    return projects;
  }

  /**
   * Handles get server status tool requests
   * 
   * @private
   * @param {GetServerStatusArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetServerStatus(args: GetServerStatusArgs): Promise<any> {
    if (!args.language_id) {
      return 'Missing required argument: language_id';
    }
    if (!this.config.hasServerConfig(args.language_id)) {
      return `Language server '${args.language_id}' is not configured`;
    }
    const isServerRunning = this.client.isServerRunning(args.language_id);
    if (!isServerRunning) {
      return `Language server '${args.language_id}' is stopped`;
    }
    const params: WorkspaceSymbolParams = { query: 'test' };
    const result = await this.client.sendRequest(args.language_id, WorkspaceSymbolRequest.method, params);
    if (result.content) {
      return `Language server '${args.language_id}' is starting`;
    }
    return `Language server '${args.language_id}' is ready`;
  }

  /**
   * Handles get symbol definitions tool requests
   * 
   * @private
   * @param {GetSymbolArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSymbolDefinitions(args: GetSymbolArgs): Promise<any> {
    if (!args.file_path || args.character === undefined || args.line === undefined) {
      return 'Missing required arguments: character, file_path, and line';
    }
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, DefinitionRequest.method, params);
    return result;
  }

  /**
   * Handles get symbol references tool requests
   * 
   * @private
   * @param {GetSymbolReferencesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSymbolReferences(args: GetSymbolReferencesArgs): Promise<any> {
    if (!args.file_path || args.character === undefined || args.line === undefined) {
      return 'Missing required arguments: character, file_path, and line';
    }
    const params: ReferenceParams = {
      context: { includeDeclaration: args.include_declaration ?? true },
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, ReferencesRequest.method, params);
    return result;
  }

  /**
   * Handles workspace symbols tool requests
   * 
   * @private
   * @param {GetSymbolsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSymbols(args: GetSymbolsArgs): Promise<any> {
    if (!args.project_name) {
      return 'Missing required argument: project_name';
    }
    if (!args.query) {
      return 'Missing required argument: query';
    }
    const results: any[] = [];
    for (const languageId of this.client.getServers()) {
      if (this.client.isServerRunning(languageId)) {
        await this.client.loadProjectFiles(languageId, args.project_name);
        const params: WorkspaceSymbolParams = { query: args.query };
        const result = await this.client.sendRequest(languageId, WorkspaceSymbolRequest.method, params);
        if (result && Array.isArray(result)) {
          results.push(...result.map((symbol: any) => ({ ...symbol, server: languageId })));
        }
      }
    }
    return results;
  }

  /**
   * Handles get type definitions tool requests
   * 
   * @private
   * @param {GetTypeDefinitionsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetTypeDefinitions(args: GetTypeDefinitionsArgs): Promise<any> {
    if (!args.file_path || args.character === undefined || args.line === undefined) {
      return 'Missing required arguments: character, file_path, and line';
    }
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, TypeDefinitionRequest.method, params);
    return result;
  }

  /**
   * Handles tool listing requests from MCP clients
   * 
   * @private
   * @returns {Promise<Object>} Response containing available tools
   */
  private async handleListTools(): Promise<any> {
    return { tools: this.getLspTools() };
  }

  /**
   * Handles tool execution requests from MCP clients
   * 
   * @private
   * @param {CallToolRequest} request - The tool execution request
   * @returns {Promise<Object>} Response containing tool execution results
   */
  private async handleRequest(request: CallToolRequest): Promise<any> {
    if (!request.params.arguments) {
      return 'No arguments provided';
    }
    const handler = this.toolHandlers.get(request.params.name);
    if (!handler) {
      return `Unknown tool: ${request.params.name}`;
    }
    const result = await handler(request.params.arguments);
    return this.client.response(result, typeof result === 'string' ? false : true);
  }

  /**
   * Handles restart server tool requests
   * 
   * @private
   * @param {RestartServerArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleRestartServer(args: RestartServerArgs): Promise<any> {
    if (!args.language_id) {
      return 'Missing required argument: language_id';
    }
    await this.client.restartServer(args.language_id);
    return `Language server '${args.language_id}' restarted successfully.`;
  }

  /**
   * Handles start server tool requests
   * 
   * @private
   * @param {StartServerArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleStartServer(args: StartServerArgs): Promise<any> {
    if (!args.language_id) {
      return 'Missing required argument: language_id';
    }
    if (this.client.isServerRunning(args.language_id)) {
      return `Language server '${args.language_id}' is already running.`;
    }
    const serverConfig = this.config.getServerConfig(args.language_id);
    if (!serverConfig.command) {
      return `Language server '${args.language_id}' is not configured`;
    }
    await this.client.startServer(args.language_id);
    return `Language server '${args.language_id}' started successfully.`;
  }

  /**
   * Handles stop server tool requests
   * 
   * @private
   * @param {StopServerArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleStopServer(args: StopServerArgs): Promise<any> {
    if (!args.language_id) {
      return 'Missing required argument: language_id';
    }
    if (!this.client.isServerRunning(args.language_id)) {
      return `Language server '${args.language_id}' is not running.`;
    }
    await this.client.stopServer(args.language_id);
    return `Language server '${args.language_id}' stopped successfully.`;
  }

  /**
   * Tool definition for restarting language servers
   * 
   * @private
   * @returns {Tool} Restart server tool
   */
  private restartServerTool(): Tool {
    return {
      name: 'restart_server',
      description: 'Restart a specific language server',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Language identifier (e.g., python, typescript)' }
        },
        required: ['language_id']
      }
    };
  }

  /**
   * Sets up MCP request handlers for tool execution and tool listing
   * 
   * @private
   */
  private setupHandlers(): void {
    this.server.setRequestHandler(
      CallToolRequestSchema,
      this.handleRequest.bind(this)
    );
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      this.handleListTools.bind(this)
    );
  }

  /**
   * Sets up tool handlers registry
   * 
   * @private
   */
  private setupToolHandlers(): void {
    this.toolHandlers.set('get_code_actions', this.handleGetCodeActions.bind(this));
    this.toolHandlers.set('get_completions', this.handleGetCompletions.bind(this));
    this.toolHandlers.set('get_document_symbols', this.handleGetDocumentSymbols.bind(this));
    this.toolHandlers.set('get_hover', this.handleGetHover.bind(this));
    this.toolHandlers.set('get_server_projects', this.handleGetServerProjects.bind(this));
    this.toolHandlers.set('get_server_status', this.handleGetServerStatus.bind(this));
    this.toolHandlers.set('get_symbol_definitions', this.handleGetSymbolDefinitions.bind(this));
    this.toolHandlers.set('get_symbol_references', this.handleGetSymbolReferences.bind(this));
    this.toolHandlers.set('get_symbols', this.handleGetSymbols.bind(this));
    this.toolHandlers.set('get_type_definitions', this.handleGetTypeDefinitions.bind(this));
    this.toolHandlers.set('restart_server', this.handleRestartServer.bind(this));
    this.toolHandlers.set('start_server', this.handleStartServer.bind(this));
    this.toolHandlers.set('stop_server', this.handleStopServer.bind(this));
  }

  /**
   * Tool definition for starting language servers
   * 
   * @private
   * @returns {Tool} Start server tool
   */
  private startServerTool(): Tool {
    return {
      name: 'start_server',
      description: 'Start a specific language server',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Language identifier (e.g., python, typescript)' }
        },
        required: ['language_id']
      }
    };
  }

  /**
   * Tool definition for stopping language servers
   * 
   * @private
   * @returns {Tool} Stop server tool
   */
  private stopServerTool(): Tool {
    return {
      name: 'stop_server',
      description: 'Stop a specific language server',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Language identifier (e.g., python, typescript)' }
        },
        required: ['language_id']
      }
    };
  }

  /**
   * Connects the MCP server to the specified transport with proper error handling
   * 
   * @param {StdioServerTransport} transport - Transport for MCP communication
   * @returns {Promise<void>} Promise that resolves when connection is established
   */
  async connect(transport: StdioServerTransport): Promise<void> {
    this.transport = transport;
    transport.onerror = () => { };
    await this.server.connect(transport);
  }
}
