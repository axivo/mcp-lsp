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
  CallHierarchyIncomingCallsParams,
  CallHierarchyIncomingCallsRequest,
  CallHierarchyOutgoingCallsParams,
  CallHierarchyOutgoingCallsRequest,
  CallHierarchyPrepareParams,
  CallHierarchyPrepareRequest,
  CodeActionParams,
  CodeActionRequest,
  CompletionRequest,
  DefinitionRequest,
  DocumentColorRequest,
  DocumentFormattingRequest,
  DocumentLinkRequest,
  DocumentRangeFormattingRequest,
  DocumentSymbolRequest,
  FoldingRangeRequest,
  HoverRequest,
  ImplementationRequest,
  InlayHintParams,
  InlayHintRequest,
  InlayHintResolveRequest,
  LinkedEditingRangeParams,
  LinkedEditingRangeRequest,
  ReferenceParams,
  ReferencesRequest,
  RenameParams,
  RenameRequest,
  SelectionRangeParams,
  SelectionRangeRequest,
  SignatureHelpRequest,
  TextDocumentPositionParams,
  TypeDefinitionRequest,
  TypeHierarchyPrepareParams,
  TypeHierarchyPrepareRequest,
  TypeHierarchySubtypesParams,
  TypeHierarchySubtypesRequest,
  TypeHierarchySupertypesParams,
  TypeHierarchySupertypesRequest,
  WorkspaceSymbolParams,
  WorkspaceSymbolRequest
} from 'vscode-languageserver-protocol';
import { LspClient } from "./client.js";
import { LspConfigParser } from "./config.js";

interface GetCallHierarchyArgs {
  character: number;
  file_path: string;
  line: number;
}

interface GetCodeActionsArgs {
  character: number;
  file_path: string;
  line: number;
}

interface GetColorsArgs {
  file_path: string;
}

interface GetCompletionsArgs {
  character: number;
  file_path: string;
  line: number;
}

interface GetFormatArgs {
  file_path: string;
}

interface GetFoldingRangesArgs {
  file_path: string;
}

interface GetHoverArgs {
  character: number;
  file_path: string;
  line: number;
}

interface GetImplementationsArgs {
  character: number;
  file_path: string;
  line: number;
}

interface GetIncomingCallsArgs {
  item: any;
}

interface GetInlayHintArgs {
  item: any;
}

interface GetInlayHintsArgs {
  end_character: number;
  end_line: number;
  file_path: string;
  start_character: number;
  start_line: number;
}

interface GetLinkedEditingRangeArgs {
  character: number;
  file_path: string;
  line: number;
}

interface GetLinksArgs {
  file_path: string;
}

interface GetOutgoingCallsArgs {
  item: any;
}

interface GetRangeFormatArgs {
  end_character: number;
  end_line: number;
  file_path: string;
  start_character: number;
  start_line: number;
}

interface GetSelectionRangeArgs {
  character: number;
  file_path: string;
  line: number;
}

interface GetServerProjectsArgs {
  language_id: string;
}

interface GetServerStatusArgs {
  language_id?: string;
}

interface GetSignatureArgs {
  character: number;
  file_path: string;
  line: number;
}

interface GetSubtypesArgs {
  item: any;
}

interface GetSupertypesArgs {
  item: any;
}

interface GetSymbolDefinitionsArgs {
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

interface GetSymbolRenamesArgs {
  character: number;
  file_path: string;
  line: number;
  new_name: string;
}

interface GetSymbolsArgs {
  file_path: string;
}

interface GetTypeDefinitionsArgs {
  character: number;
  file_path: string;
  line: number;
}

interface GetTypeHierarchyArgs {
  character: number;
  file_path: string;
  line: number;
}

interface GetWorkspaceSymbolsArgs {
  project_name: string;
  query: string;
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
      { name: 'language-server-protocol', version: this.client.version() },
      { capabilities: { tools: {} } }
    );
    this.toolHandlers = new Map<string, ToolHandler>();
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
      description: 'Prepare call hierarchy for the language element',
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
   * Tool definition for getting document colors
   * 
   * @private
   * @returns {Tool} Document colors tool
   */
  private getColorsTool(): Tool {
    return {
      name: 'get_colors',
      description: 'Get color information from a document',
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
   * Tool definition for getting folding ranges
   * 
   * @private
   * @returns {Tool} Folding ranges tool
   */
  private getFoldingRangesTool(): Tool {
    return {
      name: 'get_folding_ranges',
      description: 'Get folding ranges for code organization',
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
   * Tool definition for getting document format
   * 
   * @private
   * @returns {Tool} Document format tool
   */
  private getFormatTool(): Tool {
    return {
      name: 'get_format',
      description: 'Get document formatting suggestions using language server formatting rules',
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
   * Tool definition for getting implementations
   * 
   * @private
   * @returns {Tool} Implementations tool
   */
  private getImplementationsTool(): Tool {
    return {
      name: 'get_implementations',
      description: 'Get all implementation locations',
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
      description: 'Get incoming calls for a call hierarchy item',
      inputSchema: {
        type: 'object',
        properties: {
          item: { type: 'object', description: 'Call hierarchy item from get_call_hierarchy' }
        },
        required: ['item']
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
      description: 'Get detailed information for an inlay hint item',
      inputSchema: {
        type: 'object',
        properties: {
          item: { type: 'object', description: 'Inlay hint item from get_inlay_hints' }
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
      description: 'Get inlay hints for a document range',
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
   * Tool definition for getting linked editing range
   * 
   * @private
   * @returns {Tool} Linked editing range tool
   */
  private getLinkedEditingRangeTool(): Tool {
    return {
      name: 'get_linked_editing_range',
      description: 'Find ranges that should be edited together',
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
   * Tool definition for getting document links
   * 
   * @private
   * @returns {Tool} Document links tool
   */
  private getLinksTool(): Tool {
    return {
      name: 'get_links',
      description: 'Get document links and references',
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
      description: 'Get outgoing calls for a call hierarchy item',
      inputSchema: {
        type: 'object',
        properties: {
          item: { type: 'object', description: 'Call hierarchy item from get_call_hierarchy' }
        },
        required: ['item']
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
      description: 'Get range formatting suggestions using language server formatting rules',
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
   * Tool definition for getting selection range
   * 
   * @private
   * @returns {Tool} Selection range tool
   */
  private getSelectionRangeTool(): Tool {
    return {
      name: 'get_selection_range',
      description: 'Smart text selection expansion',
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
      description: 'Get status of all language servers or a specific language server',
      inputSchema: {
        type: 'object',
        properties: {
          language_id: { type: 'string', description: 'Optional language identifier (e.g., python, typescript)' }
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
      description: 'Get function signature help and parameter information at a specific position',
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
      description: 'Get subtypes for a type hierarchy item',
      inputSchema: {
        type: 'object',
        properties: {
          item: { type: 'object', description: 'Type hierarchy item from get_type_hierarchy' }
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
      description: 'Get supertypes for a type hierarchy item',
      inputSchema: {
        type: 'object',
        properties: {
          item: { type: 'object', description: 'Type hierarchy item from get_type_hierarchy' }
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
      description: 'Get all workspace symbol definition locations',
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
      description: 'Get all workspace symbol usage locations',
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
      description: 'Get workspace-wide symbol rename suggestions',
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
   * Returns all available MCP tools
   * 
   * @private
   * @returns {Tool[]} Array of MCP tool definitions
   */
  private getTools(): Tool[] {
    return [
      this.getCallHierarchyTool(),
      this.getCodeActionsTool(),
      this.getColorsTool(),
      this.getCompletionsTool(),
      this.getFoldingRangesTool(),
      this.getFormatTool(),
      this.getHoverTool(),
      this.getImplementationsTool(),
      this.getIncomingCallsTool(),
      this.getInlayHintTool(),
      this.getInlayHintsTool(),
      this.getLinkedEditingRangeTool(),
      this.getLinksTool(),
      this.getOutgoingCallsTool(),
      this.getRangeFormatTool(),
      this.getSelectionRangeTool(),
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
      this.getWorkspaceSymbolsTool(),
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
   * Tool definition for getting type hierarchy
   * 
   * @private
   * @returns {Tool} Get type hierarchy tool
   */
  private getTypeHierarchyTool(): Tool {
    return {
      name: 'get_type_hierarchy',
      description: 'Prepare type hierarchy for the language element',
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
   * Tool definition for workspace symbol search
   * 
   * @private
   * @returns {Tool} Workspace symbols tool
   */
  private getWorkspaceSymbolsTool(): Tool {
    return {
      name: 'get_workspace_symbols',
      description: 'Search for symbols across entire workspace by name',
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
   * Handles get call hierarchy tool requests
   * 
   * @private
   * @param {GetCallHierarchyArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetCallHierarchy(args: GetCallHierarchyArgs): Promise<any> {
    if (!args.file_path || args.character === undefined || args.line === undefined) {
      return 'Missing required arguments: character, file_path, and line';
    }
    const params: CallHierarchyPrepareParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, CallHierarchyPrepareRequest.method, params);
    return result;
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
   * Handles get colors tool requests
   * 
   * @private
   * @param {GetColorsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetColors(args: GetColorsArgs): Promise<any> {
    if (!args.file_path) {
      return 'Missing required argument: file_path';
    }
    const params = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, DocumentColorRequest.method, params);
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
   * Handles get folding ranges tool requests
   * 
   * @private
   * @param {GetFoldingRangesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetFoldingRanges(args: GetFoldingRangesArgs): Promise<any> {
    if (!args.file_path) {
      return 'Missing required argument: file_path';
    }
    const params = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, FoldingRangeRequest.method, params);
    return result;
  }

  /**
   * Handles get format tool requests
   * 
   * @private
   * @param {GetFormatArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetFormat(args: GetFormatArgs): Promise<any> {
    if (!args.file_path) {
      return 'Missing required argument: file_path';
    }
    const params = {
      textDocument: { uri: `file://${args.file_path}` },
      options: { tabSize: 2, insertSpaces: true }
    };
    const result = await this.client.sendServerRequest(args.file_path, DocumentFormattingRequest.method, params);
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
   * Handles get implementations tool requests
   * 
   * @private
   * @param {GetImplementationsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetImplementations(args: GetImplementationsArgs): Promise<any> {
    if (!args.file_path || args.character === undefined || args.line === undefined) {
      return 'Missing required arguments: character, file_path, and line';
    }
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, ImplementationRequest.method, params);
    return result;
  }

  /**
   * Handles get incoming calls tool requests
   * 
   * @private
   * @param {GetIncomingCallsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetIncomingCalls(args: GetIncomingCallsArgs): Promise<any> {
    if (!args.item) {
      return 'Missing required argument: item';
    }
    const params: CallHierarchyIncomingCallsParams = {
      item: args.item
    };
    const filePath = args.item.uri ? args.item.uri.replace('file://', '') : null;
    if (!filePath) {
      return 'Invalid call hierarchy item: missing URI';
    }
    const result = await this.client.sendServerRequest(filePath, CallHierarchyIncomingCallsRequest.method, params);
    return result;
  }

  /**
   * Handles get inlay hint tool requests
   * 
   * @private
   * @param {GetInlayHintArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetInlayHint(args: GetInlayHintArgs): Promise<any> {
    if (!args.item) {
      return 'Missing required argument: item';
    }
    const result = await this.client.sendServerRequest('', InlayHintResolveRequest.method, args.item);
    return result;
  }

  /**
   * Handles get inlay hints tool requests
   * 
   * @private
   * @param {GetInlayHintsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetInlayHints(args: GetInlayHintsArgs): Promise<any> {
    if (!args.file_path || args.start_line === undefined || args.start_character === undefined ||
      args.end_line === undefined || args.end_character === undefined) {
      return 'Missing required arguments: end_character, end_line, file_path, start_character, and start_line';
    }
    const params: InlayHintParams = {
      range: {
        start: { character: args.start_character, line: args.start_line },
        end: { character: args.end_character, line: args.end_line }
      },
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, InlayHintRequest.method, params);
    return result;
  }

  /**
   * Handles get linked editing range tool requests
   * 
   * @private
   * @param {GetLinkedEditingRangeArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetLinkedEditingRange(args: GetLinkedEditingRangeArgs): Promise<any> {
    if (!args.file_path || args.character === undefined || args.line === undefined) {
      return 'Missing required arguments: character, file_path, and line';
    }
    const params: LinkedEditingRangeParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, LinkedEditingRangeRequest.method, params);
    return result;
  }

  /**
   * Handles get links tool requests
   * 
   * @private
   * @param {GetLinksArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetLinks(args: GetLinksArgs): Promise<any> {
    if (!args.file_path) {
      return 'Missing required argument: file_path';
    }
    const params = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, DocumentLinkRequest.method, params);
    return result;
  }

  /**
   * Handles get outgoing calls tool requests
   * 
   * @private
   * @param {GetOutgoingCallsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetOutgoingCalls(args: GetOutgoingCallsArgs): Promise<any> {
    if (!args.item) {
      return 'Missing required argument: item';
    }
    const params: CallHierarchyOutgoingCallsParams = {
      item: args.item
    };
    const filePath = args.item.uri ? args.item.uri.replace('file://', '') : null;
    if (!filePath) {
      return 'Invalid call hierarchy item: missing URI';
    }
    const result = await this.client.sendServerRequest(filePath, CallHierarchyOutgoingCallsRequest.method, params);
    return result;
  }

  /**
   * Handles get range format tool requests
   * 
   * @private
   * @param {GetRangeFormatArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetRangeFormat(args: GetRangeFormatArgs): Promise<any> {
    if (!args.file_path || args.start_line === undefined || args.start_character === undefined ||
      args.end_line === undefined || args.end_character === undefined) {
      return 'Missing required arguments: end_character, end_line, file_path, start_character, and start_line';
    }
    const params = {
      range: {
        start: { character: args.start_character, line: args.start_line },
        end: { character: args.end_character, line: args.end_line }
      },
      textDocument: { uri: `file://${args.file_path}` },
      options: { tabSize: 2, insertSpaces: true }
    };
    const result = await this.client.sendServerRequest(args.file_path, DocumentRangeFormattingRequest.method, params);
    return result;
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
   * Handles get selection range tool requests
   * 
   * @private
   * @param {GetSelectionRangeArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSelectionRange(args: GetSelectionRangeArgs): Promise<any> {
    if (!args.file_path || args.character === undefined || args.line === undefined) {
      return 'Missing required arguments: character, file_path, and line';
    }
    const params: SelectionRangeParams = {
      positions: [{ character: args.character, line: args.line }],
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, SelectionRangeRequest.method, params);
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
      return `Language server '${args.language_id}' is not configured.`;
    }
    if (!this.client.isServerRunning(args.language_id)) {
      return `Language server '${args.language_id}' is not running.`;
    }
    const serverConfig = this.config.getServerConfig(args.language_id);
    const projects = serverConfig.projects.map(project => ({
      project_name: project.name,
      description: project.description,
      url: project.url,
      path: project.path,
      configuration: serverConfig.configuration,
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
      const status = this.client.getServers().map(async (languageId) => {
        const connection = this.client.isServerRunning(languageId);
        const uptime = this.client.getServerUptime(languageId);
        if (!connection) {
          return [languageId, { status: 'stopped', uptime: 0 }];
        }
        const serverConnection = this.client.getServerConnection(languageId);
        if (!serverConnection || !serverConnection.initialized) {
          return [languageId, { status: 'starting', uptime }];
        }
        return [languageId, { status: 'ready', uptime }];
      });
      const results = await Promise.all(status);
      return Object.fromEntries(results);
    }
    if (!this.config.hasServerConfig(args.language_id)) {
      return { status: 'not_configured', uptime: 0 };
    }
    const connection = this.client.isServerRunning(args.language_id);
    if (!connection) {
      return { status: 'stopped', uptime: 0 };
    }
    const serverConnection = this.client.getServerConnection(args.language_id);
    const uptime = this.client.getServerUptime(args.language_id);
    if (!serverConnection || !serverConnection.initialized) {
      return { status: 'starting', uptime };
    }
    return { status: 'ready', uptime };
  }

  /**
   * Handles get signature tool requests
   * 
   * @private
   * @param {GetSignatureArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSignature(args: GetSignatureArgs): Promise<any> {
    if (!args.file_path || args.character === undefined || args.line === undefined) {
      return 'Missing required arguments: character, file_path, and line';
    }
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, SignatureHelpRequest.method, params);
    return result;
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
      return `Language server '${args.language_id}' is not configured.`;
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
   * Handles get subtypes tool requests
   * 
   * @private
   * @param {GetSubtypesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSubtypes(args: GetSubtypesArgs): Promise<any> {
    if (!args.item) {
      return 'Missing required argument: item';
    }
    const params: TypeHierarchySubtypesParams = {
      item: args.item
    };
    const filePath = args.item.uri ? args.item.uri.replace('file://', '') : null;
    if (!filePath) {
      return 'Invalid type hierarchy item: missing URI';
    }
    const result = await this.client.sendServerRequest(filePath, TypeHierarchySubtypesRequest.method, params);
    return result;
  }

  /**
   * Handles get supertypes tool requests
   * 
   * @private
   * @param {GetSupertypesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSupertypes(args: GetSupertypesArgs): Promise<any> {
    if (!args.item) {
      return 'Missing required argument: item';
    }
    const params: TypeHierarchySupertypesParams = {
      item: args.item
    };
    const filePath = args.item.uri ? args.item.uri.replace('file://', '') : null;
    if (!filePath) {
      return 'Invalid type hierarchy item: missing URI';
    }
    const result = await this.client.sendServerRequest(filePath, TypeHierarchySupertypesRequest.method, params);
    return result;
  }

  /**
   * Handles get symbol definitions tool requests
   * 
   * @private
   * @param {GetSymbolDefinitionsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSymbolDefinitions(args: GetSymbolDefinitionsArgs): Promise<any> {
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
   * Handles get symbol renames tool requests
   * 
   * @private
   * @param {GetSymbolRenamesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSymbolRenames(args: GetSymbolRenamesArgs): Promise<any> {
    if (!args.file_path || args.character === undefined || args.line === undefined || !args.new_name) {
      return 'Missing required arguments: character, file_path, line, and new_name';
    }
    const params: RenameParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` },
      newName: args.new_name
    };
    const result = await this.client.sendServerRequest(args.file_path, RenameRequest.method, params);
    return result;
  }

  /**
   * Handles get symbols tool requests
   * 
   * @private
   * @param {GetSymbolsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSymbols(args: GetSymbolsArgs): Promise<any> {
    if (!args.file_path) {
      return 'Missing required argument: file_path';
    }
    const params = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, DocumentSymbolRequest.method, params);
    return result;
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
   * Handles get type hierarchy tool requests
   * 
   * @private
   * @param {GetTypeHierarchyArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetTypeHierarchy(args: GetTypeHierarchyArgs): Promise<any> {
    if (!args.file_path || args.character === undefined || args.line === undefined) {
      return 'Missing required arguments: character, file_path, and line';
    }
    const params: TypeHierarchyPrepareParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    const result = await this.client.sendServerRequest(args.file_path, TypeHierarchyPrepareRequest.method, params);
    return result;
  }

  /**
   * Handles workspace symbol search tool requests
   * 
   * @private
   * @param {GetWorkspaceSymbolsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetWorkspaceSymbols(args: GetWorkspaceSymbolsArgs): Promise<any> {
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
   * Handles tool listing requests from MCP clients
   * 
   * @private
   * @returns {Promise<Object>} Response containing available tools
   */
  private async handleTools(): Promise<any> {
    return { tools: this.getTools() };
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
    this.server.setRequestHandler(CallToolRequestSchema, this.handleRequest.bind(this));
    this.server.setRequestHandler(ListToolsRequestSchema, this.handleTools.bind(this));
  }

  /**
   * Sets up tool handlers registry
   * 
   * @private
   */
  private setupToolHandlers(): void {
    this.toolHandlers.set('get_call_hierarchy', this.handleGetCallHierarchy.bind(this));
    this.toolHandlers.set('get_code_actions', this.handleGetCodeActions.bind(this));
    this.toolHandlers.set('get_colors', this.handleGetColors.bind(this));
    this.toolHandlers.set('get_completions', this.handleGetCompletions.bind(this));
    this.toolHandlers.set('get_folding_ranges', this.handleGetFoldingRanges.bind(this));
    this.toolHandlers.set('get_format', this.handleGetFormat.bind(this));
    this.toolHandlers.set('get_hover', this.handleGetHover.bind(this));
    this.toolHandlers.set('get_implementations', this.handleGetImplementations.bind(this));
    this.toolHandlers.set('get_incoming_calls', this.handleGetIncomingCalls.bind(this));
    this.toolHandlers.set('get_inlay_hint', this.handleGetInlayHint.bind(this));
    this.toolHandlers.set('get_inlay_hints', this.handleGetInlayHints.bind(this));
    this.toolHandlers.set('get_linked_editing_range', this.handleGetLinkedEditingRange.bind(this));
    this.toolHandlers.set('get_links', this.handleGetLinks.bind(this));
    this.toolHandlers.set('get_outgoing_calls', this.handleGetOutgoingCalls.bind(this));
    this.toolHandlers.set('get_range_format', this.handleGetRangeFormat.bind(this));
    this.toolHandlers.set('get_selection_range', this.handleGetSelectionRange.bind(this));
    this.toolHandlers.set('get_server_projects', this.handleGetServerProjects.bind(this));
    this.toolHandlers.set('get_server_status', this.handleGetServerStatus.bind(this));
    this.toolHandlers.set('get_signature', this.handleGetSignature.bind(this));
    this.toolHandlers.set('get_subtypes', this.handleGetSubtypes.bind(this));
    this.toolHandlers.set('get_supertypes', this.handleGetSupertypes.bind(this));
    this.toolHandlers.set('get_symbol_definitions', this.handleGetSymbolDefinitions.bind(this));
    this.toolHandlers.set('get_symbol_references', this.handleGetSymbolReferences.bind(this));
    this.toolHandlers.set('get_symbol_renames', this.handleGetSymbolRenames.bind(this));
    this.toolHandlers.set('get_symbols', this.handleGetSymbols.bind(this));
    this.toolHandlers.set('get_type_definitions', this.handleGetTypeDefinitions.bind(this));
    this.toolHandlers.set('get_type_hierarchy', this.handleGetTypeHierarchy.bind(this));
    this.toolHandlers.set('get_workspace_symbols', this.handleGetWorkspaceSymbols.bind(this));
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
