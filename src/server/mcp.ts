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
import { Client } from './client.js';
import { Config } from './config.js';
import { GetServerCapabilities, McpTool } from './tool.js';

interface ServerTools {
  capability: string;
  handler: ToolHandler;
  tool: Tool;
}

type ToolHandler = (args: any) => Promise<any>;

/**
 * LSP MCP Server implementation
 * 
 * @class McpServer
 */
export class McpServer {
  private client: Client;
  private config: Config;
  private limit: number;
  private server: Server;
  private tool: McpTool;
  private toolHandler: Map<string, ToolHandler>;
  private transport?: StdioServerTransport;

  /**
   * Creates a new McpServer instance
   * 
   * @param {string} configPath - Path to the LSP configuration file
   */
  constructor(configPath: string) {
    this.client = new Client(configPath);
    this.config = new Config(configPath);
    this.limit = 250;
    this.server = new Server(
      { name: 'language-server-protocol', version: this.client.version() },
      { capabilities: { tools: {} } }
    );
    this.tool = new McpTool(this.client, this.config, this.limit);
    this.toolHandler = new Map<string, ToolHandler>();
    this.setupToolHandlers();
    this.setupHandlers();
  }

  /**
   * Tool definition for getting call hierarchy
   * 
   * @private
   * @returns {Tool} Get call hierarchy tool
   */
  private getCallHierarchyTool(): Tool {
    return {
      name: 'get_call_hierarchy',
      description: 'Build call hierarchy showing caller and callee relationships',
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
   * Tool definition for getting code actions
   * 
   * @private
   * @returns {Tool} Code actions tool
   */
  private getCodeActionsTool(): Tool {
    return {
      name: 'get_code_actions',
      description: 'Get automated code fixes and refactoring suggestions at cursor position',
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
   * Tool definition for resolving code actions
   * 
   * @private
   * @returns {Tool} Code action resolve tool
   */
  private getCodeResolvesTool(): Tool {
    return {
      name: 'get_code_resolves',
      description: 'Resolve additional details for a code action item',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the project file where the code action was obtained' },
          item: { type: 'object', description: 'Code action item from get_code_actions tool' }
        },
        required: ['file_path', 'item']
      }
    };
  }

  /**
   * Tool definition for getting document colors
   * 
   * @private
   * @returns {Tool} Document colors tool
   */
  private getColorsTool(): Tool {
    return {
      name: 'get_colors',
      description: 'Extract color definitions and references from document',
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
   * Tool definition for getting code completions
   * 
   * @private
   * @returns {Tool} Code completions tool
   */
  private getCompletionsTool(): Tool {
    return {
      name: 'get_completions',
      description: 'Get completions and auto-suggestions at cursor position',
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
   * Tool definition for getting folding ranges
   * 
   * @private
   * @returns {Tool} Folding ranges tool
   */
  private getFoldingRangesTool(): Tool {
    return {
      name: 'get_folding_ranges',
      description: 'Identify collapsible code sections for code editor folding',
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
   * Tool definition for getting format
   * 
   * @private
   * @returns {Tool} Format tool
   */
  private getFormatTool(): Tool {
    return {
      name: 'get_format',
      description: 'Format entire document using language server rules',
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
   * Tool definition for getting highlights
   * 
   * @private
   * @returns {Tool} Highlights tool
   */
  private getHighlightsTool(): Tool {
    return {
      name: 'get_highlights',
      description: 'Highlight all occurrences of symbol at cursor position',
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
   * Tool definition for getting hover information
   * 
   * @private
   * @returns {Tool} Hover information tool
   */
  private getHoverTool(): Tool {
    return {
      name: 'get_hover',
      description: 'Show type information and documentation at cursor position',
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
   * Tool definition for getting implementations
   * 
   * @private
   * @returns {Tool} Implementations tool
   */
  private getImplementationsTool(): Tool {
    return {
      name: 'get_implementations',
      description: 'Find all locations where interface or abstract method is implemented',
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
   * Tool definition for getting incoming calls
   * 
   * @private
   * @returns {Tool} Get incoming calls tool
   */
  private getIncomingCallsTool(): Tool {
    return {
      name: 'get_incoming_calls',
      description: 'Show all functions that call this symbol',
      inputSchema: {
        type: 'object',
        properties: {
          item: { type: 'object', description: 'Call hierarchy item from get_call_hierarchy tool' }
        },
        required: ['item']
      }
    };
  }

  /**
   * Tool definition for getting inlay hints
   * 
   * @private
   * @returns {Tool} Inlay hints tool
   */
  private getInlayHintsTool(): Tool {
    return {
      name: 'get_inlay_hints',
      description: 'Show inline type annotations and parameter hints in code range',
      inputSchema: {
        type: 'object',
        properties: {
          end_character: { type: 'number', description: 'End character position (zero-based)' },
          end_line: { type: 'number', description: 'End line number (zero-based)' },
          file_path: { type: 'string', description: 'Path to the project file' },
          start_character: { type: 'number', description: 'Start character position (zero-based)' },
          start_line: { type: 'number', description: 'Start line number (zero-based)' }
        },
        required: ['end_character', 'end_line', 'file_path', 'start_character', 'start_line']
      }
    };
  }

  /**
   * Tool definition for getting inlay hint details
   * 
   * @private
   * @returns {Tool} Inlay hint details tool
   */
  private getInlayHintTool(): Tool {
    return {
      name: 'get_inlay_hint',
      description: 'Resolve additional details for an inlay hint item',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the project file where the inlay hint was obtained' },
          item: { type: 'object', description: 'Inlay hint item from get_inlay_hints tool' }
        },
        required: ['file_path', 'item']
      }
    };
  }

  /**
   * Tool definition for getting linked editing range
   * 
   * @private
   * @returns {Tool} Linked editing range tool
   */
  private getLinkedEditingRangeTool(): Tool {
    return {
      name: 'get_linked_editing_range',
      description: 'Find related ranges that should be edited simultaneously',
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
   * Tool definition for resolving document links
   * 
   * @private
   * @returns {Tool} Document link resolve tool
   */
  private getLinkResolvesTool(): Tool {
    return {
      name: 'get_link_resolves',
      description: 'Resolve target URL for a document link item',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the project file where the document link was obtained' },
          item: { type: 'object', description: 'Document link item from get_links tool' }
        },
        required: ['file_path', 'item']
      }
    };
  }

  /**
   * Tool definition for getting document links
   * 
   * @private
   * @returns {Tool} Document links tool
   */
  private getLinksTool(): Tool {
    return {
      name: 'get_links',
      description: 'Extract clickable links and references from document',
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
   * Tool definition for getting outgoing calls
   * 
   * @private
   * @returns {Tool} Get outgoing calls tool
   */
  private getOutgoingCallsTool(): Tool {
    return {
      name: 'get_outgoing_calls',
      description: 'Show all functions that this symbol calls',
      inputSchema: {
        type: 'object',
        properties: {
          item: { type: 'object', description: 'Call hierarchy item from get_call_hierarchy tool' }
        },
        required: ['item']
      }
    };
  }

  /**
   * Tool definition for project symbol search
   * 
   * @private
   * @returns {Tool} Project symbols tool
   */
  private getProjectFilesTool(): Tool {
    return {
      name: 'get_project_files',
      description: 'List all files in the project workspace',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Language identifier' },
          project: { type: 'string', description: 'Project name to list files from' },
          limit: { type: 'number', description: 'Pagination limit for number of files to return', default: this.limit },
          offset: { type: 'number', description: 'Pagination offset for number of files to skip', default: 0 }
        },
        required: ['language_id', 'project']
      }
    };
  }

  /**
   * Tool definition for project symbol search
   * 
   * @private
   * @returns {Tool} Project symbols tool
   */
  private getProjectSymbolsTool(): Tool {
    return {
      name: 'get_project_symbols',
      description: 'Search for symbols across entire project workspace',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Language identifier' },
          project: { type: 'string', description: 'Project name to search within' },
          query: { type: 'string', description: 'Symbol search query' },
          limit: { type: 'number', description: 'Pagination limit for number of symbols to return', default: this.limit },
          offset: { type: 'number', description: 'Pagination offset for number of symbols to skip', default: 0 },
          timeout: { type: 'number', description: 'Optional load timeout in milliseconds' }
        },
        required: ['language_id', 'project', 'query']
      }
    };
  }

  /**
   * Tool definition for getting range format
   * 
   * @private
   * @returns {Tool} Range format tool
   */
  private getRangeFormatTool(): Tool {
    return {
      name: 'get_range_format',
      description: 'Format specific code range using language server rules',
      inputSchema: {
        type: 'object',
        properties: {
          end_character: { type: 'number', description: 'End character position (zero-based)' },
          end_line: { type: 'number', description: 'End line number (zero-based)' },
          file_path: { type: 'string', description: 'Path to the project file' },
          start_character: { type: 'number', description: 'Start character position (zero-based)' },
          start_line: { type: 'number', description: 'Start line number (zero-based)' }
        },
        required: ['end_character', 'end_line', 'file_path', 'start_character', 'start_line']
      }
    };
  }

  /**
   * Tool definition for resolving completion items
   * 
   * @private
   * @returns {Tool} Completion resolve tool
   */
  private getResolvesTool(): Tool {
    return {
      name: 'get_resolves',
      description: 'Resolve additional details for a completion item',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the project file where the completion was obtained' },
          item: { type: 'object', description: 'Completion item from get_completions tool' }
        },
        required: ['file_path', 'item']
      }
    };
  }

  /**
   * Tool definition for getting selection range
   * 
   * @private
   * @returns {Tool} Selection range tool
   */
  private getSelectionRangeTool(): Tool {
    return {
      name: 'get_selection_range',
      description: 'Expand selection to logical code boundaries',
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
   * Tool definition for getting semantic tokens
   * 
   * @private
   * @returns {Tool} Semantic tokens tool
   */
  private getSemanticTokensTool(): Tool {
    return {
      name: 'get_semantic_tokens',
      description: 'Extract detailed syntax tokens for advanced highlighting and analysis',
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
   * Tool definition for getting server capabilities
   * 
   * @private
   * @returns {Tool} Server capabilities tool
   */
  private getServerCapabilitiesTool(): Tool {
    return {
      name: 'get_server_capabilities',
      description: 'Get language server capabilities and tool mappings',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Language identifier' }
        },
        required: ['language_id']
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
      description: 'List available projects for a language server',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Language identifier' }
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
      description: 'Check running status of language servers',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Optional language identifier' }
        },
        required: []
      }
    };
  }

  /**
   * Tool definition for getting signature help
   * 
   * @private
   * @returns {Tool} Signature help tool
   */
  private getSignatureTool(): Tool {
    return {
      name: 'get_signature',
      description: 'Show function parameters and signature help at cursor position',
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
   * Tool definition for getting subtypes
   * 
   * @private
   * @returns {Tool} Get subtypes tool
   */
  private getSubtypesTool(): Tool {
    return {
      name: 'get_subtypes',
      description: 'Find all subtypes that inherit from this type',
      inputSchema: {
        type: 'object',
        properties: {
          item: { type: 'object', description: 'Type hierarchy item from get_type_hierarchy tool' }
        },
        required: ['item']
      }
    };
  }

  /**
   * Tool definition for getting supertypes
   * 
   * @private
   * @returns {Tool} Get supertypes tool
   */
  private getSupertypesTool(): Tool {
    return {
      name: 'get_supertypes',
      description: 'Find all parent types that this type inherits from',
      inputSchema: {
        type: 'object',
        properties: {
          item: { type: 'object', description: 'Type hierarchy item from get_type_hierarchy tool' }
        },
        required: ['item']
      }
    };
  }

  /**
   * Tool definition for getting symbol definitions
   * 
   * @private
   * @returns {Tool} Symbol definitions tool
   */
  private getSymbolDefinitionsTool(): Tool {
    return {
      name: 'get_symbol_definitions',
      description: 'Navigate to where symbol is originally defined',
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
      description: 'Find all locations where symbol is used or referenced',
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
   * Tool definition for getting symbol renames
   * 
   * @private
   * @returns {Tool} Symbol renames tool
   */
  private getSymbolRenamesTool(): Tool {
    return {
      name: 'get_symbol_renames',
      description: 'Preview all locations that would be renamed with symbol',
      inputSchema: {
        type: 'object',
        properties: {
          character: { type: 'number', description: 'Character position (zero-based)' },
          file_path: { type: 'string', description: 'Path to the project file' },
          line: { type: 'number', description: 'Line number (zero-based)' },
          new_name: { type: 'string', description: 'New name for the symbol' }
        },
        required: ['character', 'file_path', 'line', 'new_name']
      }
    };
  }

  /**
   * Tool definition for getting document symbols
   * 
   * @private
   * @returns {Tool} Document symbols tool
   */
  private getSymbolsTool(): Tool {
    return {
      name: 'get_symbols',
      description: 'List all symbols in document',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the project file' },
          limit: { type: 'number', description: 'Pagination limit for number of symbols to return', default: this.limit },
          offset: { type: 'number', description: 'Pagination offset for number of symbols to skip', default: 0 }
        },
        required: ['file_path']
      }
    };
  }

  /**
   * Returns all available MCP tools
   * 
   * @private
   * @returns {Tool[]} Array of MCP tool definitions
   */
  private getTools(): Tool[] {
    return [
      this.getCallHierarchyTool(),
      this.getCodeActionsTool(),
      this.getCodeResolvesTool(),
      this.getColorsTool(),
      this.getCompletionsTool(),
      this.getFoldingRangesTool(),
      this.getFormatTool(),
      this.getHighlightsTool(),
      this.getHoverTool(),
      this.getImplementationsTool(),
      this.getIncomingCallsTool(),
      this.getInlayHintTool(),
      this.getInlayHintsTool(),
      this.getLinkedEditingRangeTool(),
      this.getLinkResolvesTool(),
      this.getLinksTool(),
      this.getOutgoingCallsTool(),
      this.getProjectFilesTool(),
      this.getProjectSymbolsTool(),
      this.getRangeFormatTool(),
      this.getResolvesTool(),
      this.getSelectionRangeTool(),
      this.getSemanticTokensTool(),
      this.getServerCapabilitiesTool(),
      this.getServerProjectsTool(),
      this.getServerStatusTool(),
      this.getSignatureTool(),
      this.getSubtypesTool(),
      this.getSupertypesTool(),
      this.getSymbolDefinitionsTool(),
      this.getSymbolReferencesTool(),
      this.getSymbolRenamesTool(),
      this.getSymbolsTool(),
      this.getTypeDefinitionsTool(),
      this.getTypeHierarchyTool(),
      this.loadProjectFilesTool(),
      this.restartServerTool(),
      this.startServerTool(),
      this.stopServerTool()
    ];
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
      description: 'Navigate to where symbol type is defined',
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
   * Tool definition for getting type hierarchy
   * 
   * @private
   * @returns {Tool} Get type hierarchy tool
   */
  private getTypeHierarchyTool(): Tool {
    return {
      name: 'get_type_hierarchy',
      description: 'Build type hierarchy showing inheritance relationships',
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
   * Handles tool execution requests from MCP clients
   * 
   * @private
   * @param {CallToolRequest} request - The tool execution request
   * @returns {Promise<any>} Response containing tool execution results
   */
  private async handleRequest(request: CallToolRequest): Promise<any> {
    if (!request.params.arguments) {
      return 'No arguments provided';
    }
    const handler = this.toolHandler.get(request.params.name);
    if (!handler) {
      return `Unknown tool: ${request.params.name}`;
    }
    const result = await handler(request.params.arguments);
    return this.client.response(result, typeof result === 'string' ? false : true);
  }

  /**
   * Handles tool listing requests from MCP clients
   * 
   * @private
   * @returns {Promise<any>} Response containing available tools
   */
  private async handleTools(): Promise<any> {
    return { tools: this.getTools() };
  }

  /**
   * Tool definition for loading project files
   * 
   * @private
   * @returns {Tool} Load project files tool
   */
  private loadProjectFilesTool(): Tool {
    return {
      name: 'load_project_files',
      description: 'Load all project files into language server for full workspace analysis',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Language identifier' },
          project: { type: 'string', description: 'Project name to load all project files from' },
          timeout: { type: 'number', description: 'Optional load timeout in milliseconds' }
        },
        required: ['language_id', 'project']
      }
    };
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
      description: 'Restart language server with optional project selection',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Language identifier' },
          project: { type: 'string', description: 'Project name to load' }
        },
        required: ['language_id', 'project']
      }
    };
  }

  /**
   * Returns the correlation between server capabilities and available tools
   * 
   * @private
   * @returns {ServerTools[]} Array of tool mappings
   */
  private setServerTools(): ServerTools[] {
    const getServerCapabilities = (args: GetServerCapabilities) => this.tool.getServerCapabilities(args, this.setServerTools());
    return [
      { tool: this.getCallHierarchyTool(), capability: 'callHierarchyProvider', handler: this.tool.getCallHierarchy.bind(this.tool) },
      { tool: this.getCodeActionsTool(), capability: 'codeActionProvider', handler: this.tool.getCodeActions.bind(this.tool) },
      { tool: this.getCodeResolvesTool(), capability: 'codeActionProvider', handler: this.tool.getCodeResolves.bind(this.tool) },
      { tool: this.getColorsTool(), capability: 'colorProvider', handler: this.tool.getColors.bind(this.tool) },
      { tool: this.getCompletionsTool(), capability: 'completionProvider', handler: this.tool.getCompletions.bind(this.tool) },
      { tool: this.getFoldingRangesTool(), capability: 'foldingRangeProvider', handler: this.tool.getFoldingRanges.bind(this.tool) },
      { tool: this.getFormatTool(), capability: 'documentFormattingProvider', handler: this.tool.getFormat.bind(this.tool) },
      { tool: this.getHighlightsTool(), capability: 'documentHighlightProvider', handler: this.tool.getHighlights.bind(this.tool) },
      { tool: this.getHoverTool(), capability: 'hoverProvider', handler: this.tool.getHover.bind(this.tool) },
      { tool: this.getImplementationsTool(), capability: 'implementationProvider', handler: this.tool.getImplementations.bind(this.tool) },
      { tool: this.getIncomingCallsTool(), capability: 'callHierarchyProvider', handler: this.tool.getIncomingCalls.bind(this.tool) },
      { tool: this.getInlayHintTool(), capability: 'inlayHintProvider', handler: this.tool.getInlayHint.bind(this.tool) },
      { tool: this.getInlayHintsTool(), capability: 'inlayHintProvider', handler: this.tool.getInlayHints.bind(this.tool) },
      { tool: this.getLinkedEditingRangeTool(), capability: 'linkedEditingRangeProvider', handler: this.tool.getLinkedEditingRange.bind(this.tool) },
      { tool: this.getLinkResolvesTool(), capability: 'documentLinkProvider', handler: this.tool.getLinkResolves.bind(this.tool) },
      { tool: this.getLinksTool(), capability: 'documentLinkProvider', handler: this.tool.getLinks.bind(this.tool) },
      { tool: this.getOutgoingCallsTool(), capability: 'callHierarchyProvider', handler: this.tool.getOutgoingCalls.bind(this.tool) },
      { tool: this.getProjectFilesTool(), capability: 'serverOperations', handler: this.tool.getProjectFiles.bind(this.tool) },
      { tool: this.getProjectSymbolsTool(), capability: 'workspaceSymbolProvider', handler: this.tool.getProjectSymbols.bind(this.tool) },
      { tool: this.getRangeFormatTool(), capability: 'documentRangeFormattingProvider', handler: this.tool.getRangeFormat.bind(this.tool) },
      { tool: this.getResolvesTool(), capability: 'completionProvider', handler: this.tool.getResolves.bind(this.tool) },
      { tool: this.getSelectionRangeTool(), capability: 'selectionRangeProvider', handler: this.tool.getSelectionRange.bind(this.tool) },
      { tool: this.getSemanticTokensTool(), capability: 'semanticTokensProvider', handler: this.tool.getSemanticTokens.bind(this.tool) },
      { tool: this.getServerCapabilitiesTool(), capability: 'serverOperations', handler: getServerCapabilities },
      { tool: this.getServerProjectsTool(), capability: 'serverOperations', handler: this.tool.getServerProjects.bind(this.tool) },
      { tool: this.getServerStatusTool(), capability: 'serverOperations', handler: this.tool.getServerStatus.bind(this.tool) },
      { tool: this.getSignatureTool(), capability: 'signatureHelpProvider', handler: this.tool.getSignature.bind(this.tool) },
      { tool: this.getSubtypesTool(), capability: 'typeHierarchyProvider', handler: this.tool.getSubtypes.bind(this.tool) },
      { tool: this.getSupertypesTool(), capability: 'typeHierarchyProvider', handler: this.tool.getSupertypes.bind(this.tool) },
      { tool: this.getSymbolDefinitionsTool(), capability: 'definitionProvider', handler: this.tool.getSymbolDefinitions.bind(this.tool) },
      { tool: this.getSymbolReferencesTool(), capability: 'referencesProvider', handler: this.tool.getSymbolReferences.bind(this.tool) },
      { tool: this.getSymbolRenamesTool(), capability: 'renameProvider', handler: this.tool.getSymbolRenames.bind(this.tool) },
      { tool: this.getSymbolsTool(), capability: 'documentSymbolProvider', handler: this.tool.getSymbols.bind(this.tool) },
      { tool: this.getTypeDefinitionsTool(), capability: 'typeDefinitionProvider', handler: this.tool.getTypeDefinitions.bind(this.tool) },
      { tool: this.getTypeHierarchyTool(), capability: 'typeHierarchyProvider', handler: this.tool.getTypeHierarchy.bind(this.tool) },
      { tool: this.loadProjectFilesTool(), capability: 'serverOperations', handler: this.tool.loadProjectFiles.bind(this.tool) },
      { tool: this.restartServerTool(), capability: 'serverOperations', handler: this.tool.restartServer.bind(this.tool) },
      { tool: this.startServerTool(), capability: 'serverOperations', handler: this.tool.startServer.bind(this.tool) },
      { tool: this.stopServerTool(), capability: 'serverOperations', handler: this.tool.stopServer.bind(this.tool) }
    ];
  }

  /**
   * Sets up MCP request handlers for tool execution and tool listing
   * 
   * @private
   */
  private setupHandlers(): void {
    this.server.setRequestHandler(CallToolRequestSchema, this.handleRequest.bind(this));
    this.server.setRequestHandler(ListToolsRequestSchema, this.handleTools.bind(this));
  }

  /**
   * Sets up tool handlers registry
   * 
   * @private
   */
  private setupToolHandlers(): void {
    const tools = this.setServerTools();
    for (const { tool, handler } of tools) {
      const wrappedHandler: ToolHandler = async (args: any) => {
        const processedArgs = { ...args };
        const properties = tool.inputSchema?.properties;
        if (properties) {
          Object.entries(properties).forEach(([name, value]) => {
            const schema = value as { default?: unknown };
            if (processedArgs[name] === undefined && schema.default !== undefined) {
              processedArgs[name] = schema.default;
            }
          });
        }
        return await handler(processedArgs);
      };
      this.toolHandler.set(tool.name, wrappedHandler);
    }
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
      description: 'Start language server with project selection',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Language identifier' },
          project: { type: 'string', description: 'Optional project name to load (default: first server language project)' }
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
      description: 'Stop running language server',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Language identifier' }
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
