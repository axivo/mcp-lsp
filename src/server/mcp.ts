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
  CallHierarchyItem,
  CallHierarchyOutgoingCallsParams,
  CallHierarchyOutgoingCallsRequest,
  CallHierarchyPrepareParams,
  CallHierarchyPrepareRequest,
  CodeAction,
  CodeActionParams,
  CodeActionRequest,
  CodeActionResolveRequest,
  CompletionItem,
  CompletionRequest,
  CompletionResolveRequest,
  DefinitionRequest,
  DocumentColorRequest,
  DocumentFormattingRequest,
  DocumentHighlightRequest,
  DocumentLink,
  DocumentLinkRequest,
  DocumentLinkResolveRequest,
  DocumentRangeFormattingRequest,
  DocumentSymbolRequest,
  FoldingRangeRequest,
  HoverRequest,
  ImplementationRequest,
  InlayHint,
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
  SemanticTokensParams,
  SemanticTokensRequest,
  ServerCapabilities,
  SignatureHelpRequest,
  TextDocumentPositionParams,
  TypeDefinitionRequest,
  TypeHierarchyItem,
  TypeHierarchyPrepareParams,
  TypeHierarchyPrepareRequest,
  TypeHierarchySubtypesParams,
  TypeHierarchySubtypesRequest,
  TypeHierarchySupertypesParams,
  TypeHierarchySupertypesRequest,
  WorkspaceSymbolParams,
  WorkspaceSymbolRequest
} from 'vscode-languageserver-protocol';
import { z } from 'zod';
import { Client } from './client.js';
import { Config } from './config.js';

interface FilePathArgs {
  file_path: string;
}

interface GetCallHierarchyArgs extends PositionArgs { }

interface GetCodeActionsArgs extends PositionArgs { }

interface GetCodeResolvesArgs extends ResolveArgs {
  item: CodeAction;
}

interface GetColorsArgs extends FilePathArgs { }

interface GetCompletionsArgs extends PositionArgs { }

interface GetFoldingRangesArgs extends FilePathArgs { }

interface GetFormatArgs extends FilePathArgs { }

interface GetHighlightsArgs extends PositionArgs { }

interface GetHoverArgs extends PositionArgs { }

interface GetImplementationsArgs extends PositionArgs { }

interface GetIncomingCallsArgs {
  item: CallHierarchyItem;
}

interface GetInlayHintArgs extends ResolveArgs {
  item: InlayHint;
}

interface GetInlayHintsArgs extends RangeArgs { }

interface GetLinkedEditingRangeArgs extends PositionArgs { }

interface GetLinkResolvesArgs extends ResolveArgs {
  item: DocumentLink;
}

interface GetLinksArgs extends FilePathArgs { }

interface GetOutgoingCallsArgs {
  item: CallHierarchyItem;
}

interface GetProjectFilesArgs extends ProjectArgs {
  limit?: number;
  offset?: number;
}

interface GetProjectSymbolsArgs extends ProjectArgs {
  query: string;
  limit?: number;
  offset?: number;
  timeout?: number;
}

interface GetRangeFormatArgs extends RangeArgs { }

interface GetResolvesArgs extends ResolveArgs {
  item: CompletionItem;
}

interface GetSelectionRangeArgs extends PositionArgs { }

interface GetSemanticTokensArgs extends FilePathArgs { }

interface GetServerCapabilitiesArgs extends LanguageIdArgs { }

interface GetServerProjectsArgs extends LanguageIdArgs { }

interface GetServerStatusArgs {
  language_id?: string;
}

interface GetSignatureArgs extends PositionArgs { }

interface GetSubtypesArgs {
  item: TypeHierarchyItem;
}

interface GetSupertypesArgs {
  item: TypeHierarchyItem;
}

interface GetSymbolDefinitionsArgs extends PositionArgs { }

interface GetSymbolReferencesArgs extends PositionArgs {
  include_declaration?: boolean;
}

interface GetSymbolRenamesArgs extends PositionArgs {
  new_name: string;
}

interface GetSymbolsArgs extends FilePathArgs {
  limit?: number;
  offset?: number;
}

interface GetTypeDefinitionsArgs extends PositionArgs { }

interface GetTypeHierarchyArgs extends PositionArgs { }

interface LanguageIdArgs {
  language_id: string;
}

interface LoadProjectFilesArgs extends ProjectArgs {
  timeout?: number;
}

interface PageMetadata {
  more: boolean;
  offset: number;
  total: number;
}

interface PositionArgs {
  character: number;
  file_path: string;
  line: number;
}

interface ProjectArgs {
  language_id: string;
  project: string;
}

interface RangeArgs {
  end_character: number;
  end_line: number;
  file_path: string;
  start_character: number;
  start_line: number;
}

interface ResolveArgs {
  file_path: string;
  item: any;
}

interface RestartServerArgs extends LanguageIdArgs {
  project: string;
}

interface ServerStatus {
  status: 'error' | 'ready' | 'starting' | 'stopped' | 'unconfigured';
  uptime: string;
  error?: string;
  languageId?: string;
  pid?: number;
  project?: string;
}

interface ServerTools {
  capability: string;
  handler: ToolHandler;
  tool: Tool;
}

interface StartServerArgs extends LanguageIdArgs {
  project?: string;
}

interface StopServerArgs extends LanguageIdArgs { }

type ToolHandler = (args: any) => Promise<any>;

/**
 * LSP MCP Server implementation
 * 
 * @class McpServer
 */
export class McpServer {
  private client: Client;
  private config: Config;
  private server: Server;
  private toolHandlers: Map<string, ToolHandler>;
  private toolPaginationLimit: number;
  private transport?: StdioServerTransport;

  /**
   * Creates a new McpServer instance
   * 
   * @param {string} configPath - Path to the LSP configuration file
   */
  constructor(configPath: string) {
    this.client = new Client(configPath);
    this.config = new Config(configPath);
    this.server = new Server(
      { name: 'language-server-protocol', version: this.client.version() },
      { capabilities: { tools: {} } }
    );
    this.toolHandlers = new Map<string, ToolHandler>();
    this.toolPaginationLimit = 250;
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
          limit: { type: 'number', description: 'Pagination limit for number of files to return', default: this.toolPaginationLimit },
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
          limit: { type: 'number', description: 'Pagination limit for number of symbols to return', default: this.toolPaginationLimit },
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
          limit: { type: 'number', description: 'Pagination limit for number of symbols to return', default: this.toolPaginationLimit },
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
   * Handles get call hierarchy tool requests
   * 
   * @private
   * @param {GetCallHierarchyArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetCallHierarchy(args: GetCallHierarchyArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'character', 'line']);
    if (error) return error;
    const params: CallHierarchyPrepareParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, CallHierarchyPrepareRequest.method, params);
  }

  /**
   * Handles get code actions tool requests
   * 
   * @private
   * @param {GetCodeActionsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetCodeActions(args: GetCodeActionsArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'character', 'line']);
    if (error) return error;
    const params: CodeActionParams = {
      context: { diagnostics: [] },
      range: {
        start: { character: args.character, line: args.line },
        end: { character: args.character, line: args.line }
      },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, CodeActionRequest.method, params);
  }

  /**
   * Handles get code resolves tool requests
   * 
   * @private
   * @param {GetCodeResolvesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetCodeResolves(args: GetCodeResolvesArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'item']);
    if (error) return error;
    return await this.client.sendServerRequest(args.file_path, CodeActionResolveRequest.method, args.item);
  }

  /**
   * Handles get colors tool requests
   * 
   * @private
   * @param {GetColorsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetColors(args: GetColorsArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path']);
    if (error) return error;
    const params = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DocumentColorRequest.method, params);
  }

  /**
   * Handles get completions tool requests
   * 
   * @private
   * @param {GetCompletionsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetCompletions(args: GetCompletionsArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'character', 'line']);
    if (error) return error;
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, CompletionRequest.method, params);
  }

  /**
   * Handles get folding ranges tool requests
   * 
   * @private
   * @param {GetFoldingRangesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetFoldingRanges(args: GetFoldingRangesArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path']);
    if (error) return error;
    const params = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, FoldingRangeRequest.method, params);
  }

  /**
   * Handles get format tool requests
   * 
   * @private
   * @param {GetFormatArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetFormat(args: GetFormatArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path']);
    if (error) return error;
    const params = {
      options: { tabSize: 2, insertSpaces: true },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DocumentFormattingRequest.method, params);
  }

  /**
   * Handles get highlights tool requests
   * 
   * @private
   * @param {GetHighlightsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetHighlights(args: GetHighlightsArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'character', 'line']);
    if (error) return error;
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DocumentHighlightRequest.method, params);
  }

  /**
   * Handles get hover tool requests
   * 
   * @private
   * @param {GetHoverArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetHover(args: GetHoverArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'character', 'line']);
    if (error) return error;
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, HoverRequest.method, params);
  }

  /**
   * Handles get implementations tool requests
   * 
   * @private
   * @param {GetImplementationsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetImplementations(args: GetImplementationsArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'character', 'line']);
    if (error) return error;
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, ImplementationRequest.method, params);
  }

  /**
   * Handles get incoming calls tool requests
   * 
   * @private
   * @param {GetIncomingCallsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetIncomingCalls(args: GetIncomingCallsArgs): Promise<any> {
    const error = this.validateArgs(args, ['item']);
    if (error) return error;
    const params: CallHierarchyIncomingCallsParams = {
      item: args.item
    };
    const filePath = this.setFilePath(args.item);
    return await this.client.sendServerRequest(filePath, CallHierarchyIncomingCallsRequest.method, params);
  }

  /**
   * Handles get inlay hint tool requests
   * 
   * @private
   * @param {GetInlayHintArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetInlayHint(args: GetInlayHintArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'item']);
    if (error) return error;
    return await this.client.sendServerRequest(args.file_path, InlayHintResolveRequest.method, args.item);
  }

  /**
   * Handles get inlay hints tool requests
   * 
   * @private
   * @param {GetInlayHintsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetInlayHints(args: GetInlayHintsArgs): Promise<any> {
    const error = this.validateArgs(args, ['end_character', 'end_line', 'file_path', 'start_character', 'start_line']);
    if (error) return error;
    const params: InlayHintParams = {
      range: {
        start: { character: args.start_character, line: args.start_line },
        end: { character: args.end_character, line: args.end_line }
      },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, InlayHintRequest.method, params);
  }

  /**
   * Handles get linked editing range tool requests
   * 
   * @private
   * @param {GetLinkedEditingRangeArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetLinkedEditingRange(args: GetLinkedEditingRangeArgs): Promise<any> {
    const error = this.validateArgs(args, ['character', 'file_path', 'line']);
    if (error) return error;
    const params: LinkedEditingRangeParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, LinkedEditingRangeRequest.method, params);
  }

  /**
   * Handles get link resolves tool requests
   * 
   * @private
   * @param {GetLinkResolvesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetLinkResolves(args: GetLinkResolvesArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'item']);
    if (error) return error;
    return await this.client.sendServerRequest(args.file_path, DocumentLinkResolveRequest.method, args.item);
  }

  /**
   * Handles get links tool requests
   * 
   * @private
   * @param {GetLinksArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetLinks(args: GetLinksArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path']);
    if (error) return error;
    const params = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DocumentLinkRequest.method, params);
  }

  /**
   * Handles get outgoing calls tool requests
   * 
   * @private
   * @param {GetOutgoingCallsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetOutgoingCalls(args: GetOutgoingCallsArgs): Promise<any> {
    const error = this.validateArgs(args, ['item']);
    if (error) return error;
    const params: CallHierarchyOutgoingCallsParams = {
      item: args.item
    };
    const filePath = this.setFilePath(args.item);
    return await this.client.sendServerRequest(filePath, CallHierarchyOutgoingCallsRequest.method, params);
  }

  /**
   * Handles project symbol search tool requests
   * 
   * @private
   * @param {GetProjectSymbolsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetProjectFiles(args: GetProjectFilesArgs): Promise<any> {
    const error = this.validateArgs(args, ['language_id', 'project']);
    if (error) return error;
    if (args.project !== this.client.getProjectId(args.language_id)) {
      return `Language server '${args.language_id}' for project '${args.project}' is not running.`;
    }
    const serverConfig = this.config.getServerConfig(args.language_id);
    const projectConfig = serverConfig.projects.find(id => id.name === args.project) as { name: string, path: string };
    const files = await this.client.getProjectFiles(args.language_id, args.project);
    if (!files) {
      return `No files found for '${args.project}' project in '${args.language_id}' language server.`;
    }
    const limit = args.limit ?? this.toolPaginationLimit;
    const offset = args.offset ?? 0;
    const total = files.length;
    const paginatedFiles = files.slice(offset, offset + limit);
    const more = offset + limit < total;
    const description = `Showing ${paginatedFiles.length} of ${total} project files.`;
    const data = {
      language_id: args.language_id,
      project: args.project,
      files: paginatedFiles,
      path: projectConfig.path
    };
    const pagination: PageMetadata = { more, offset, total };
    return this.client.response(description, false, { data, pagination });
  }

  /**
   * Handles project symbol search tool requests
   * 
   * @private
   * @param {GetProjectSymbolsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetProjectSymbols(args: GetProjectSymbolsArgs): Promise<any> {
    const error = this.validateArgs(args, ['language_id', 'project', 'query']);
    if (error) return error;
    if (args.project !== this.client.getProjectId(args.language_id)) {
      return `Language server '${args.language_id}' for project '${args.project}' is not running.`;
    }
    const params: WorkspaceSymbolParams = { query: args.query };
    const fullResult = await this.client.sendRequest(args.language_id, args.project, WorkspaceSymbolRequest.method, params);
    if (typeof fullResult === 'string' || !Array.isArray(fullResult)) {
      return this.client.response(fullResult);
    }
    const limit = args.limit ?? this.toolPaginationLimit;
    const offset = args.offset ?? 0;
    const total = fullResult.length;
    const paginatedItems = fullResult.slice(offset, offset + limit);
    const more = offset + limit < total;
    const description = `Showing ${paginatedItems.length} of ${total} project symbols.`;
    const data = {
      language_id: args.language_id,
      project: args.project,
      query: args.query,
      symbols: paginatedItems
    };
    const pagination: PageMetadata = { more, offset, total };
    return this.client.response(description, false, { data, pagination });
  }

  /**
   * Handles get range format tool requests
   * 
   * @private
   * @param {GetRangeFormatArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetRangeFormat(args: GetRangeFormatArgs): Promise<any> {
    const error = this.validateArgs(args, ['end_character', 'end_line', 'file_path', 'start_character', 'start_line']);
    if (error) return error;
    const params = {
      options: { tabSize: 2, insertSpaces: true },
      range: {
        start: { character: args.start_character, line: args.start_line },
        end: { character: args.end_character, line: args.end_line }
      },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DocumentRangeFormattingRequest.method, params);
  }

  /**
   * Handles get resolves tool requests
   * 
   * @private
   * @param {GetResolvesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetResolves(args: GetResolvesArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'item']);
    if (error) return error;
    const params = {
      ...args.item,
      uri: `file://${args.file_path}`
    };
    return await this.client.sendServerRequest(args.file_path, CompletionResolveRequest.method, params);
  }

  /**
   * Handles get selection range tool requests
   * 
   * @private
   * @param {GetSelectionRangeArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSelectionRange(args: GetSelectionRangeArgs): Promise<any> {
    const error = this.validateArgs(args, ['character', 'file_path', 'line']);
    if (error) return error;
    const params: SelectionRangeParams = {
      positions: [{ character: args.character, line: args.line }],
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, SelectionRangeRequest.method, params);
  }

  /**
   * Handles get semantic tokens tool requests
   * 
   * @private
   * @param {GetSemanticTokensArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSemanticTokens(args: GetSemanticTokensArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path']);
    if (error) return error;
    const params: SemanticTokensParams = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, SemanticTokensRequest.method, params);
  }

  /**
   * Generates capability to tool mapping based on server capabilities
   * 
   * @private
   * @param {ServerCapabilities} capabilities - Server capabilities object
   * @returns {Record<string, Tool | Tool[] | null>} Mapping of capabilities to tool definitions
   */
  private generateCapabilityToolMap(capabilities: ServerCapabilities): Record<string, Tool | Tool[] | null> {
    const server = new Map<string, Tool[]>();
    const toolMap: Record<string, Tool | Tool[] | null> = {};
    const tools = this.setServerTools();
    for (const { tool, capability } of tools) {
      if (!server.has(capability)) {
        server.set(capability, []);
      }
      server.get(capability)!.push(tool);
    }
    for (const [capability, value] of Object.entries(capabilities)) {
      if (value) {
        if (server.has(capability)) {
          const tool = server.get(capability)!;
          toolMap[capability] = tool.length === 1 ? tool[0] : tool;
        } else {
          toolMap[capability] = null;
        }
      }
    }
    const serverOperations = server.get('serverOperations');
    if (serverOperations && serverOperations.length) {
      toolMap['serverOperations'] = serverOperations;
    }
    return toolMap;
  }

  /**
   * Handles get server capabilities tool requests
   * 
   * @private
   * @param {GetServerCapabilitiesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetServerCapabilities(args: GetServerCapabilitiesArgs): Promise<any> {
    const error = this.validateArgs(args, ['language_id']);
    if (error) return error;
    if (!this.config.hasServerConfig(args.language_id)) {
      return `Language server '${args.language_id}' is not configured.`;
    }
    if (!this.client.isServerRunning(args.language_id)) {
      return `Language server '${args.language_id}' is not running.`;
    }
    const project = this.client.getProjectId(args.language_id);
    const capabilities = this.client.getServerCapabilities(args.language_id);
    if (!capabilities) {
      return `Capabilities not available for '${args.language_id}' language server.`;
    }
    const tools = this.generateCapabilityToolMap(capabilities);
    return { language_id: args.language_id, project, capabilities, tools };
  }

  /**
   * Handles get server projects tool requests
   * 
   * @private
   * @param {GetServerProjectsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetServerProjects(args: GetServerProjectsArgs): Promise<any> {
    const error = this.validateArgs(args, ['language_id']);
    if (error) return error;
    if (!this.config.hasServerConfig(args.language_id)) {
      return `Language server '${args.language_id}' is not configured.`;
    }
    if (!this.client.isServerRunning(args.language_id)) {
      return `Language server '${args.language_id}' is not running.`;
    }
    const serverConfig = this.config.getServerConfig(args.language_id);
    const projects = serverConfig.projects.map(project => ({
      name: project.name,
      path: project.path,
      extensions: serverConfig.extensions,
      configuration: serverConfig.configuration ?? {},
      description: project.description ?? '',
      url: project.url ?? ''
    }));
    return projects;
  }

  /**
   * Handles get server status tool requests
   * 
   * @private
   * @param {GetServerStatusArgs} args - Tool arguments
   * @returns {Promise<ServerStatus | Record<string, ServerStatus>>} Tool execution response
   */
  private async handleGetServerStatus(args: GetServerStatusArgs): Promise<ServerStatus | Record<string, ServerStatus>> {
    if (!args.language_id) {
      const statusPromises = this.client.getServers().map(async (languageId) => {
        try {
          const connection = this.client.isServerRunning(languageId);
          const uptime = this.client.getServerUptime(languageId);
          if (!connection) {
            return [languageId, { languageId, status: 'stopped', uptime: `0ms` }];
          }
          const serverConnection = this.client.getServerConnection(languageId);
          if (!serverConnection || !serverConnection.initialized) {
            const pid = serverConnection?.process?.pid;
            const project = serverConnection?.name;
            return [languageId, { languageId, project, pid, status: 'starting', uptime: `${uptime}ms` }];
          }
          const pid = serverConnection.process.pid;
          const project = serverConnection.name;
          return [languageId, { languageId, project, pid, status: 'ready', uptime: `${uptime}ms` }];
        } catch (error) {
          return [languageId, { status: 'error', uptime: `0ms`, error: error instanceof Error ? error.message : String(error) }];
        }
      });
      const results = await Promise.allSettled(statusPromises);
      const statusEntries = results.map(result => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return ['unknown', { status: 'error', uptime: `0ms`, error: result.reason }];
        }
      });
      return Object.fromEntries(statusEntries);
    }
    if (!this.config.hasServerConfig(args.language_id)) {
      return { languageId: args.language_id, status: 'unconfigured', uptime: `0ms` };
    }
    const connection = this.client.isServerRunning(args.language_id);
    if (!connection) {
      return { languageId: args.language_id, status: 'stopped', uptime: `0ms` };
    }
    const serverConnection = this.client.getServerConnection(args.language_id);
    const uptime = this.client.getServerUptime(args.language_id);
    if (!serverConnection || !serverConnection.initialized) {
      const pid = serverConnection?.process?.pid;
      const project = serverConnection?.name;
      return { languageId: args.language_id, project, pid, status: 'starting', uptime: `${uptime}ms` };
    }
    const pid = serverConnection.process.pid;
    const project = serverConnection.name;
    return { languageId: args.language_id, project, pid, status: 'ready', uptime: `${uptime}ms` };
  }

  /**
   * Handles get signature tool requests
   * 
   * @private
   * @param {GetSignatureArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSignature(args: GetSignatureArgs): Promise<any> {
    const error = this.validateArgs(args, ['character', 'file_path', 'line']);
    if (error) return error;
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, SignatureHelpRequest.method, params);
  }

  /**
   * Handles get subtypes tool requests
   * 
   * @private
   * @param {GetSubtypesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSubtypes(args: GetSubtypesArgs): Promise<any> {
    const error = this.validateArgs(args, ['item']);
    if (error) return error;
    const params: TypeHierarchySubtypesParams = {
      item: args.item
    };
    const filePath = this.setFilePath(args.item);
    return await this.client.sendServerRequest(filePath, TypeHierarchySubtypesRequest.method, params);
  }

  /**
   * Handles get supertypes tool requests
   * 
   * @private
   * @param {GetSupertypesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSupertypes(args: GetSupertypesArgs): Promise<any> {
    const error = this.validateArgs(args, ['item']);
    if (error) return error;
    const params: TypeHierarchySupertypesParams = {
      item: args.item
    };
    const filePath = this.setFilePath(args.item);
    return await this.client.sendServerRequest(filePath, TypeHierarchySupertypesRequest.method, params);
  }

  /**
   * Handles get symbol definitions tool requests
   * 
   * @private
   * @param {GetSymbolDefinitionsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSymbolDefinitions(args: GetSymbolDefinitionsArgs): Promise<any> {
    const error = this.validateArgs(args, ['character', 'file_path', 'line']);
    if (error) return error;
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DefinitionRequest.method, params);
  }

  /**
   * Handles get symbol references tool requests
   * 
   * @private
   * @param {GetSymbolReferencesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSymbolReferences(args: GetSymbolReferencesArgs): Promise<any> {
    const error = this.validateArgs(args, ['character', 'file_path', 'line']);
    if (error) return error;
    const params: ReferenceParams = {
      context: { includeDeclaration: args.include_declaration ?? true },
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, ReferencesRequest.method, params);
  }

  /**
   * Handles get symbol renames tool requests
   * 
   * @private
   * @param {GetSymbolRenamesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSymbolRenames(args: GetSymbolRenamesArgs): Promise<any> {
    const error = this.validateArgs(args, ['character', 'file_path', 'line', 'new_name']);
    if (error) return error;
    const params: RenameParams = {
      newName: args.new_name,
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, RenameRequest.method, params);
  }

  /**
   * Handles get symbols tool requests
   * 
   * @private
   * @param {GetSymbolsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetSymbols(args: GetSymbolsArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path']);
    if (error) return error;
    const timer = Date.now();
    const params = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    const fullResult = await this.client.sendServerRequest(args.file_path, DocumentSymbolRequest.method, params);
    if (typeof fullResult === 'string' || !Array.isArray(fullResult)) {
      return this.client.response(fullResult);
    }
    const limit = args.limit ?? this.toolPaginationLimit;
    const offset = args.offset ?? 0;
    const total = fullResult.length;
    const paginatedItems = fullResult.slice(offset, offset + limit);
    const more = offset + limit < total;
    const description = `Showing ${paginatedItems.length} of ${total} document symbols.`;
    const elapsed = Date.now() - timer;
    const data = {
      symbols: paginatedItems,
      file_path: args.file_path,
      time: `${elapsed}ms`
    };
    const pagination: PageMetadata = { more, offset, total };
    return this.client.response(description, false, { data, pagination });
  }

  /**
   * Handles get type definitions tool requests
   * 
   * @private
   * @param {GetTypeDefinitionsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetTypeDefinitions(args: GetTypeDefinitionsArgs): Promise<any> {
    const error = this.validateArgs(args, ['character', 'file_path', 'line']);
    if (error) return error;
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, TypeDefinitionRequest.method, params);
  }

  /**
   * Handles get type hierarchy tool requests
   * 
   * @private
   * @param {GetTypeHierarchyArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleGetTypeHierarchy(args: GetTypeHierarchyArgs): Promise<any> {
    const error = this.validateArgs(args, ['character', 'file_path', 'line']);
    if (error) return error;
    const params: TypeHierarchyPrepareParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, TypeHierarchyPrepareRequest.method, params);
  }

  /**
   * Handles load project files tool requests
   * 
   * @private
   * @param {LoadProjectFilesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleLoadProjectFiles(args: LoadProjectFilesArgs): Promise<any> {
    const error = this.validateArgs(args, ['language_id', 'project']);
    if (error) return error;
    if (!this.config.hasServerConfig(args.language_id)) {
      return `Language server '${args.language_id}' is not configured.`;
    }
    if (!this.client.isServerRunning(args.language_id)) {
      return `Language server '${args.language_id}' is not running.`;
    }
    return await this.client.loadProjectFiles(args.language_id, args.project, args.timeout);
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
    const error = this.validateArgs(args, ['language_id', 'project']);
    if (error) return error;
    return await this.client.restartServer(args.language_id, args.project);
  }

  /**
   * Handles start server tool requests
   * 
   * @private
   * @param {StartServerArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleStartServer(args: StartServerArgs): Promise<any> {
    const error = this.validateArgs(args, ['language_id']);
    if (error) return error;
    return await this.client.startServer(args.language_id, args.project);
  }

  /**
   * Handles stop server tool requests
   * 
   * @private
   * @param {StopServerArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleStopServer(args: StopServerArgs): Promise<any> {
    const error = this.validateArgs(args, ['language_id']);
    if (error) return error;
    if (!this.client.isServerRunning(args.language_id)) {
      return `Language server '${args.language_id}' is not running.`;
    }
    const connection = this.client.getServerConnection(args.language_id);
    if (connection) {
      await this.client.stopServer(connection.name);
    }
    return `Successfully stopped '${args.language_id}' language server.`;
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
   * Extracts file path from URI and validates it
   * 
   * @private
   * @param {object} item - Object containing name and optional uri property
   * @param {string} item.name - Name identifier for the item
   * @param {string} [item.uri] - URI to extract file path from
   * @returns {string} File path without 'file://' prefix
   * @throws {string} Error message if URI is missing or invalid
   */
  private setFilePath(item: { name: string, uri?: string }): string {
    if (!item.uri) {
      return `Invalid '${item.name}' item: missing URI`;
    }
    return item.uri.replace('file://', '');
  }

  /**
   * Returns the correlation between server capabilities and available tools
   * 
   * @private
   * @returns {ServerTools[]} Array of tool mappings
   */
  private setServerTools(): ServerTools[] {
    return [
      { tool: this.getCallHierarchyTool(), capability: 'callHierarchyProvider', handler: this.handleGetCallHierarchy.bind(this) },
      { tool: this.getCodeActionsTool(), capability: 'codeActionProvider', handler: this.handleGetCodeActions.bind(this) },
      { tool: this.getCodeResolvesTool(), capability: 'codeActionProvider', handler: this.handleGetCodeResolves.bind(this) },
      { tool: this.getColorsTool(), capability: 'colorProvider', handler: this.handleGetColors.bind(this) },
      { tool: this.getCompletionsTool(), capability: 'completionProvider', handler: this.handleGetCompletions.bind(this) },
      { tool: this.getFoldingRangesTool(), capability: 'foldingRangeProvider', handler: this.handleGetFoldingRanges.bind(this) },
      { tool: this.getFormatTool(), capability: 'documentFormattingProvider', handler: this.handleGetFormat.bind(this) },
      { tool: this.getHighlightsTool(), capability: 'documentHighlightProvider', handler: this.handleGetHighlights.bind(this) },
      { tool: this.getHoverTool(), capability: 'hoverProvider', handler: this.handleGetHover.bind(this) },
      { tool: this.getImplementationsTool(), capability: 'implementationProvider', handler: this.handleGetImplementations.bind(this) },
      { tool: this.getIncomingCallsTool(), capability: 'callHierarchyProvider', handler: this.handleGetIncomingCalls.bind(this) },
      { tool: this.getInlayHintTool(), capability: 'inlayHintProvider', handler: this.handleGetInlayHint.bind(this) },
      { tool: this.getInlayHintsTool(), capability: 'inlayHintProvider', handler: this.handleGetInlayHints.bind(this) },
      { tool: this.getLinkedEditingRangeTool(), capability: 'linkedEditingRangeProvider', handler: this.handleGetLinkedEditingRange.bind(this) },
      { tool: this.getLinkResolvesTool(), capability: 'documentLinkProvider', handler: this.handleGetLinkResolves.bind(this) },
      { tool: this.getLinksTool(), capability: 'documentLinkProvider', handler: this.handleGetLinks.bind(this) },
      { tool: this.getOutgoingCallsTool(), capability: 'callHierarchyProvider', handler: this.handleGetOutgoingCalls.bind(this) },
      { tool: this.getProjectFilesTool(), capability: 'serverOperations', handler: this.handleGetProjectFiles.bind(this) },
      { tool: this.getProjectSymbolsTool(), capability: 'workspaceSymbolProvider', handler: this.handleGetProjectSymbols.bind(this) },
      { tool: this.getRangeFormatTool(), capability: 'documentRangeFormattingProvider', handler: this.handleGetRangeFormat.bind(this) },
      { tool: this.getResolvesTool(), capability: 'completionProvider', handler: this.handleGetResolves.bind(this) },
      { tool: this.getSelectionRangeTool(), capability: 'selectionRangeProvider', handler: this.handleGetSelectionRange.bind(this) },
      { tool: this.getSemanticTokensTool(), capability: 'semanticTokensProvider', handler: this.handleGetSemanticTokens.bind(this) },
      { tool: this.getServerCapabilitiesTool(), capability: 'serverOperations', handler: this.handleGetServerCapabilities.bind(this) },
      { tool: this.getServerProjectsTool(), capability: 'serverOperations', handler: this.handleGetServerProjects.bind(this) },
      { tool: this.getServerStatusTool(), capability: 'serverOperations', handler: this.handleGetServerStatus.bind(this) },
      { tool: this.getSignatureTool(), capability: 'signatureHelpProvider', handler: this.handleGetSignature.bind(this) },
      { tool: this.getSubtypesTool(), capability: 'typeHierarchyProvider', handler: this.handleGetSubtypes.bind(this) },
      { tool: this.getSupertypesTool(), capability: 'typeHierarchyProvider', handler: this.handleGetSupertypes.bind(this) },
      { tool: this.getSymbolDefinitionsTool(), capability: 'definitionProvider', handler: this.handleGetSymbolDefinitions.bind(this) },
      { tool: this.getSymbolReferencesTool(), capability: 'referencesProvider', handler: this.handleGetSymbolReferences.bind(this) },
      { tool: this.getSymbolRenamesTool(), capability: 'renameProvider', handler: this.handleGetSymbolRenames.bind(this) },
      { tool: this.getSymbolsTool(), capability: 'documentSymbolProvider', handler: this.handleGetSymbols.bind(this) },
      { tool: this.getTypeDefinitionsTool(), capability: 'typeDefinitionProvider', handler: this.handleGetTypeDefinitions.bind(this) },
      { tool: this.getTypeHierarchyTool(), capability: 'typeHierarchyProvider', handler: this.handleGetTypeHierarchy.bind(this) },
      { tool: this.loadProjectFilesTool(), capability: 'serverOperations', handler: this.handleLoadProjectFiles.bind(this) },
      { tool: this.restartServerTool(), capability: 'serverOperations', handler: this.handleRestartServer.bind(this) },
      { tool: this.startServerTool(), capability: 'serverOperations', handler: this.handleStartServer.bind(this) },
      { tool: this.stopServerTool(), capability: 'serverOperations', handler: this.handleStopServer.bind(this) }
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
      this.toolHandlers.set(tool.name, wrappedHandler);
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
   * Validates required arguments for tool handler methods
   * 
   * @private
   * @param {unknown} args - Tool arguments to validate
   * @param {string[]} fields - Required field names
   * @returns {string | null} Error message if validation fails, null if all required fields are present
   */
  private validateArgs(args: unknown, fields: string[]): string | null {
    const type: Record<string, z.ZodType> = {};
    for (const field of fields) {
      if (field === 'query') {
        type[field] = z.string();
      } else {
        type[field] = z.union([
          z.number(),
          z.record(z.string(), z.unknown()).refine((obj) => Object.keys(obj).length > 0),
          z.string().min(1)
        ]);
      }
    }
    const schema = z.object(type);
    const result = schema.safeParse(args);
    if (!result.success) {
      const missing = result.error.issues.map(issue => issue.path[0]);
      return `Missing required arguments: ${missing.join(', ')}`;
    }
    return null;
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
