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
  DefinitionRequest,
  ReferenceParams,
  ReferencesRequest,
  TextDocumentPositionParams,
  WorkspaceSymbolParams,
  WorkspaceSymbolRequest
} from 'vscode-languageserver-protocol';
import { LspClient } from "./client.js";

interface GetSymbolArgs {
  file_path: string;
  line: number;
  character: number;
}

interface GetSymbolReferencesArgs {
  file_path: string;
  line: number;
  character: number;
  include_declaration?: boolean;
}

interface GetWorkspaceSymbolsArgs {
  query: string;
}

interface GetServerStatusArgs {
  language_id: string;
}

interface RestartServerArgs {
  server_name?: string;
  file_path?: string;
}

interface StopServerArgs {
  language_id: string;
}

interface StartServerArgs {
  language_id: string;
}

type ToolHandler = (args: any) => Promise<any>;

/**
 * LSP MCP Server implementation
 * 
 * @class LspMcpServer
 */
export class LspMcpServer {
  private lspClient: LspClient;
  private server: Server;
  private toolHandlers: Map<string, ToolHandler>;
  private transport?: StdioServerTransport;

  /**
   * Creates a new LspMcpServer instance
   * 
   * @param {string} configPath - Path to the LSP configuration file
   */
  constructor(configPath: string) {
    this.lspClient = new LspClient(configPath);
    this.server = new Server(
      { name: 'LSP MCP Server', version: this.lspClient.version() },
      { capabilities: { tools: {} } }
    );
    this.toolHandlers = new Map<string, ToolHandler>();
    this.setupToolHandlers();
    this.setupHandlers();
  }

  /**
   * Creates a standardized response for tool execution
   * 
   * @private
   * @param {any} response - The response data from LSP server
   * @returns {Object} Standardized MCP response format
   */
  private createResponse(response: any): any {
    return { content: [{ type: 'text', text: JSON.stringify(response) }] };
  }

  /**
   * Returns all available LSP tools
   * 
   * @private
   * @returns {Tool[]} Array of LSP tool definitions
   */
  private getLspTools(): Tool[] {
    return [
      this.getServerStatusTool(),
      this.getSymbolDefinitionsTool(),
      this.getSymbolReferencesTool(),
      this.getWorkspaceSymbolsTool(),
      this.restartServerTool(),
      this.startServerTool(),
      this.stopServerTool(),
    ];
  }

  /**
   * Tool definition for getting LSP server status
   * 
   * @private
   * @returns {Tool} Server status tool
   */
  private getServerStatusTool(): Tool {
    return {
      name: 'get_server_status',
      description: 'Get status of a specific LSP server (running, indexing, ready)',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Language identifier (e.g., typescript, python)' },
        },
        required: ['language_id'],
      },
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
          file_path: { type: 'string', description: 'Path to the file' },
          line: { type: 'number', description: 'Line number (zero-based)' },
          character: { type: 'number', description: 'Character position (zero-based)' },
        },
        required: ['file_path', 'line', 'character'],
      },
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
          file_path: { type: 'string', description: 'Path to the file' },
          line: { type: 'number', description: 'Line number (zero-based)' },
          character: { type: 'number', description: 'Character position (zero-based)' },
          include_declaration: { type: 'boolean', description: 'Include declaration in results', default: true },
        },
        required: ['file_path', 'line', 'character'],
      },
    };
  }

  /**
   * Tool definition for workspace symbol search
   * 
   * @private
   * @returns {Tool} Workspace symbols tool
   */
  private getWorkspaceSymbolsTool(): Tool {
    return {
      name: 'get_workspace_symbols',
      description: 'Get symbols across entire workspace',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Symbol search query' },
        },
        required: ['query'],
      },
    };
  }

  /**
   * Tool definition for restarting LSP servers
   * 
   * @private
   * @returns {Tool} Restart server tool
   */
  private restartServerTool(): Tool {
    return {
      name: 'restart_server',
      description: 'Restart specific language server',
      inputSchema: {
        type: 'object',
        properties: {
          server_name: { type: 'string', description: 'Name of the server to restart' },
          file_path: { type: 'string', description: 'File path to determine server (alternative to server_name)' },
        },
      },
    };
  }

  /**
   * Tool definition for starting LSP servers
   * 
   * @private
   * @returns {Tool} Start server tool
   */
  private startServerTool(): Tool {
    return {
      name: 'start_server',
      description: 'Start a specific LSP server',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Language identifier (e.g., typescript, python)' },
        },
        required: ['language_id'],
      },
    };
  }

  /**
   * Tool definition for stopping LSP servers
   * 
   * @private
   * @returns {Tool} Stop server tool
   */
  private stopServerTool(): Tool {
    return {
      name: 'stop_server',
      description: 'Stop a specific LSP server',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Language identifier (e.g., typescript, python)' },
        },
        required: ['language_id'],
      },
    };
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
      throw new Error('Missing required argument: language_id');
    }
    try {
      const isRunning = this.lspClient.isServerRunning(args.language_id);
      let status = 'stopped';
      let indexingStatus = 'unknown';

      if (isRunning) {
        status = 'running';
        try {
          const params: WorkspaceSymbolParams = { query: 'test' };
          await this.lspClient.sendRequest(args.language_id, WorkspaceSymbolRequest.method, params);
          status = 'ready';
          indexingStatus = 'indexed';
        } catch (error) {
          status = 'starting';
          indexingStatus = 'indexing';
        }
      }

      const serverStatus = {
        language_id: args.language_id,
        status,
        indexingStatus,
        uptime: isRunning ? this.lspClient.getServerUptime(args.language_id) : 0
      };
      return this.createResponse(serverStatus);
    } catch (error) {
      const errorStatus = {
        language_id: args.language_id,
        status: 'error',
        indexingStatus: 'unknown',
        error: error instanceof Error ? error.message : String(error)
      };
      return this.createResponse(errorStatus);
    }
  }

  /**
   * Handles get symbol definitions tool requests
   * 
   * @private
   * @param {GetSymbolArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSymbolDefinitions(args: GetSymbolArgs): Promise<any> {
    if (!args.file_path || args.line === undefined || args.character === undefined) {
      throw new Error('Missing required arguments: file_path, line, and character');
    }
    const params: TextDocumentPositionParams = {
      textDocument: { uri: `file://${args.file_path}` },
      position: { line: args.line, character: args.character },
    };
    const result = await this.lspClient.sendServerRequest(args.file_path, DefinitionRequest.method, params);
    return this.createResponse(result);
  }

  /**
   * Handles get symbol references tool requests
   * 
   * @private
   * @param {GetSymbolReferencesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSymbolReferences(args: GetSymbolReferencesArgs): Promise<any> {
    if (!args.file_path || args.line === undefined || args.character === undefined) {
      throw new Error('Missing required arguments: file_path, line, and character');
    }
    const params: ReferenceParams = {
      textDocument: { uri: `file://${args.file_path}` },
      position: { line: args.line, character: args.character },
      context: { includeDeclaration: args.include_declaration ?? true },
    };
    const result = await this.lspClient.sendServerRequest(args.file_path, ReferencesRequest.method, params);
    return this.createResponse(result);
  }

  /**
   * Handles workspace symbols tool requests
   * 
   * @private
   * @param {GetWorkspaceSymbolsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetWorkspaceSymbols(args: GetWorkspaceSymbolsArgs): Promise<any> {
    if (!args.query) {
      throw new Error('Missing required argument: query');
    }
    const results: any[] = [];
    for (const languageId of this.lspClient.getServers()) {
      if (this.lspClient.isServerRunning(languageId)) {
        try {
          const params: WorkspaceSymbolParams = { query: args.query };
          const result = await this.lspClient.sendRequest(languageId, WorkspaceSymbolRequest.method, params);
          if (result && Array.isArray(result)) {
            results.push(...result.map((symbol: any) => ({ ...symbol, server: languageId })));
          }
        } catch (error) {
          console.warn(`Error querying workspace symbols from '${languageId}' language server:`, error);
        }
      }
    }
    return this.createResponse(results);
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
      throw new Error('Missing required argument: language_id');
    }
    if (this.lspClient.isServerRunning(args.language_id)) {
      return this.createResponse({ message: `Server ${args.language_id} is already running` });
    }
    await this.lspClient.startServer(args.language_id);
    return this.createResponse({ message: `Server ${args.language_id} started successfully` });
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
      throw new Error('Missing required argument: language_id');
    }
    if (!this.lspClient.isServerRunning(args.language_id)) {
      return this.createResponse({ message: `Server ${args.language_id} is not running` });
    }
    await this.lspClient.stopServer(args.language_id);
    return this.createResponse({ message: `Server ${args.language_id} stopped successfully` });
  }

  /**
   * Handles restart server tool requests
   * 
   * @private
   * @param {RestartServerArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleRestartServer(args: RestartServerArgs): Promise<any> {
    let serverName: string;
    if (args.server_name) {
      serverName = args.server_name;
    } else if (args.file_path) {
      throw new Error('File path based server detection not yet implemented');
    } else {
      throw new Error('Either server_name or file_path must be provided');
    }
    await this.lspClient.restartServer(serverName);
    return this.createResponse({ message: `Server ${serverName} restarted successfully` });
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
    try {
      if (!request.params.arguments) {
        throw new Error('No arguments provided');
      }
      const handler = this.toolHandlers.get(request.params.name);
      if (!handler) {
        throw new Error(`Unknown tool: ${request.params.name}`);
      }
      return await handler(request.params.arguments);
    } catch (error) {
      console.error('Error executing tool:', error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
        }],
      };
    }
  }

  /**
   * Sets up tool handlers registry
   * 
   * @private
   */
  private setupToolHandlers(): void {
    this.toolHandlers.set('get_server_status', this.handleGetServerStatus.bind(this));
    this.toolHandlers.set('get_symbol_definitions', this.handleGetSymbolDefinitions.bind(this));
    this.toolHandlers.set('get_symbol_references', this.handleGetSymbolReferences.bind(this));
    this.toolHandlers.set('get_workspace_symbols', this.handleGetWorkspaceSymbols.bind(this));
    this.toolHandlers.set('restart_server', this.handleRestartServer.bind(this));
    this.toolHandlers.set('start_server', this.handleStartServer.bind(this));
    this.toolHandlers.set('stop_server', this.handleStopServer.bind(this));
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
   * Connects the MCP server to the specified transport with proper error handling
   * 
   * @param {StdioServerTransport} transport - Transport for MCP communication
   * @returns {Promise<void>} Promise that resolves when connection is established
   */
  async connect(transport: StdioServerTransport): Promise<void> {
    this.transport = transport;
    transport.onerror = (error: Error) => {
      console.error('Transport error:', error.message);
    };
    await this.server.connect(transport);
  }
}
