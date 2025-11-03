/**
 * MCP Server implementation
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
  DocumentDiagnosticRequest,
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
import { Client, Response } from './client.js';
import { Config } from './config.js';
import { Logger } from './logger.js';
import { McpTool } from './tool.js';

/**
 * File path parameter interface for tools requiring file access
 * 
 * @interface FilePath
 * @property {string} file_path - Absolute or relative path to target file
 */
interface FilePath {
  file_path: string;
}

/**
 * Parameters for call hierarchy preparation requests
 * 
 * @interface GetCallHierarchy
 * @extends Position
 */
interface GetCallHierarchy extends Position { }

/**
 * Parameters for code action requests at cursor position
 * 
 * @interface GetCodeActions
 * @extends Position
 */
interface GetCodeActions extends Position { }

/**
 * Parameters for resolving code action details
 * 
 * @interface GetCodeResolves
 * @extends Resolve
 * @property {CodeAction} item - Code action item from previous request
 */
interface GetCodeResolves extends Resolve {
  item: CodeAction;
}

/**
 * Parameters for document color extraction requests
 * 
 * @interface GetColors
 * @extends FilePath
 */
interface GetColors extends FilePath { }

/**
 * Parameters for pull-based diagnostics requests
 * 
 * @interface GetDiagnostics
 * @extends FilePath
 */
interface GetDiagnostics extends FilePath { }

/**
 * Parameters for completion suggestions at cursor position
 * 
 * @interface GetCompletions
 * @extends Position
 * @property {number} [limit] - Maximum number of completions to return
 * @property {number} [offset] - Pagination offset for completion listing
 */
interface GetCompletions extends Position {
  limit?: number;
  offset?: number;
}

/**
 * Parameters for folding range identification requests
 * 
 * @interface GetFoldingRanges
 * @extends FilePath
 */
interface GetFoldingRanges extends FilePath { }

/**
 * Parameters for document formatting requests
 * 
 * @interface GetFormat
 * @extends FilePath
 */
interface GetFormat extends FilePath { }

/**
 * Parameters for symbol highlighting at cursor position
 * 
 * @interface GetHighlights
 * @extends Position
 */
interface GetHighlights extends Position { }

/**
 * Parameters for hover information at cursor position
 * 
 * @interface GetHover
 * @extends Position
 */
interface GetHover extends Position { }

/**
 * Parameters for implementation discovery at cursor position
 * 
 * @interface GetImplementations
 * @extends Position
 */
interface GetImplementations extends Position { }

/**
 * Parameters for call hierarchy incoming calls requests
 * 
 * @interface GetIncomingCalls
 * @property {CallHierarchyItem} item - Call hierarchy item to find callers for
 */
interface GetIncomingCalls {
  item: CallHierarchyItem;
}

/**
 * Parameters for resolving inlay hint details
 * 
 * @interface GetInlayHint
 * @extends Resolve
 * @property {InlayHint} item - Inlay hint item from previous request
 */
interface GetInlayHint extends Resolve {
  item: InlayHint;
}

/**
 * Parameters for inlay hints within a code range
 * 
 * @interface GetInlayHints
 * @extends Range
 */
interface GetInlayHints extends Range { }

/**
 * Parameters for linked editing range requests
 * 
 * @interface GetLinkedEditingRange
 * @extends Position
 */
interface GetLinkedEditingRange extends Position { }

/**
 * Parameters for resolving document link details
 * 
 * @interface GetLinkResolves
 * @extends Resolve
 * @property {DocumentLink} item - Document link item from previous request
 */
interface GetLinkResolves extends Resolve {
  item: DocumentLink;
}

/**
 * Parameters for document link extraction requests
 * 
 * @interface GetLinks
 * @extends FilePath
 */
interface GetLinks extends FilePath { }

/**
 * Parameters for call hierarchy outgoing calls requests
 * 
 * @interface GetOutgoingCalls
 * @property {CallHierarchyItem} item - Call hierarchy item to find callees for
 */
interface GetOutgoingCalls {
  item: CallHierarchyItem;
}

/**
 * Parameters for project file listing with pagination
 * 
 * @interface GetProjectFiles
 * @extends Project
 * @property {number} [limit] - Maximum number of files to return
 * @property {number} [offset] - Pagination offset for file listing
 */
interface GetProjectFiles extends Project {
  limit?: number;
  offset?: number;
}

/**
 * Parameters for project-wide symbol search with pagination
 * 
 * @interface GetProjectSymbols
 * @extends Project
 * @property {string} query - Symbol search query string
 * @property {number} [limit] - Maximum number of symbols to return
 * @property {number} [offset] - Pagination offset for symbol listing
 * @property {number} [timeout] - Optional timeout for symbol indexing
 */
interface GetProjectSymbols extends Project {
  query?: string;
  limit?: number;
  offset?: number;
  timeout?: number;
}

/**
 * Parameters for range formatting requests
 * 
 * @interface GetRangeFormat
 * @extends Range
 */
interface GetRangeFormat extends Range { }

/**
 * Parameters for resolving completion item details
 * 
 * @interface GetResolves
 * @extends Resolve
 * @property {CompletionItem} item - Completion item from previous request
 */
interface GetResolves extends Resolve {
  item: CompletionItem;
}

/**
 * Parameters for selection range expansion requests
 * 
 * @interface GetSelectionRange
 * @extends Position
 */
interface GetSelectionRange extends Position { }

/**
 * Parameters for semantic token analysis requests
 * 
 * @interface GetSemanticTokens
 * @extends FilePath
 */
interface GetSemanticTokens extends FilePath { }

/**
 * Parameters for server capability inspection
 * 
 * @interface GetServerCapabilities
 * @extends LanguageId
 */
interface GetServerCapabilities extends LanguageId { }

/**
 * Parameters for server project listing
 * 
 * @interface GetServerProjects
 * @extends LanguageId
 */
interface GetServerProjects extends LanguageId { }

/**
 * Parameters for server status queries
 * 
 * @interface GetServerStatus
 * @property {string} [language_id] - Optional specific language server to check
 */
interface GetServerStatus {
  language_id?: string;
}

/**
 * Parameters for signature help at cursor position
 * 
 * @interface GetSignature
 * @extends Position
 */
interface GetSignature extends Position { }

/**
 * Parameters for type hierarchy subtype discovery
 * 
 * @interface GetSubtypes
 * @property {TypeHierarchyItem} item - Type hierarchy item to find subtypes for
 */
interface GetSubtypes {
  item: TypeHierarchyItem;
}

/**
 * Parameters for type hierarchy supertype discovery
 * 
 * @interface GetSupertypes
 * @property {TypeHierarchyItem} item - Type hierarchy item to find supertypes for
 */
interface GetSupertypes {
  item: TypeHierarchyItem;
}

/**
 * Parameters for symbol definition lookup at cursor position
 * 
 * @interface GetSymbolDefinitions
 * @extends Position
 */
interface GetSymbolDefinitions extends Position { }

/**
 * Parameters for symbol reference search with declaration control
 * 
 * @interface GetSymbolReferences
 * @extends Position
 * @property {boolean} [include_declaration] - Whether to include symbol declaration in results
 */
interface GetSymbolReferences extends Position {
  include_declaration?: boolean;
}

/**
 * Parameters for symbol rename preview with new name
 * 
 * @interface GetSymbolRenames
 * @extends Position
 * @property {string} new_name - New name for symbol renaming operation
 */
interface GetSymbolRenames extends Position {
  new_name: string;
}

/**
 * Parameters for document symbol listing with pagination
 * 
 * @interface GetSymbols
 * @extends FilePath
 * @property {number} [limit] - Maximum number of symbols to return
 * @property {number} [offset] - Pagination offset for symbol listing
 */
interface GetSymbols extends FilePath {
  limit?: number;
  offset?: number;
}

/**
 * Parameters for type definition lookup at cursor position
 * 
 * @interface GetTypeDefinitions
 * @extends Position
 */
interface GetTypeDefinitions extends Position { }

/**
 * Parameters for type hierarchy preparation requests
 * 
 * @interface GetTypeHierarchy
 * @extends Position
 */
interface GetTypeHierarchy extends Position { }

/**
 * Language server identifier parameter
 * 
 * @interface LanguageId
 * @property {string} language_id - Language server identifier (e.g., 'typescript', 'python')
 */
interface LanguageId {
  language_id: string;
}

/**
 * Parameters for project file loading with timeout control
 * 
 * @interface LoadProjectFiles
 * @extends Project
 * @property {number} [timeout] - Optional timeout in milliseconds for file loading
 */
interface LoadProjectFiles extends Project {
  timeout?: number;
}

/**
 * Pagination metadata for paginated responses
 * 
 * @interface PageMetadata
 * @property {boolean} more - Whether more results are available
 * @property {number} offset - Current pagination offset
 * @property {number} total - Total number of available items
 */
interface PageMetadata {
  more: boolean;
  offset: number;
  total: number;
}

/**
 * Cursor position in document with file context
 * 
 * @interface Position
 * @property {number} character - Zero-based character offset within line
 * @property {string} file_path - Absolute or relative path to target file
 * @property {number} line - Zero-based line number in document
 */
interface Position {
  character: number;
  file_path: string;
  line: number;
}

/**
 * Project and language server identification
 * 
 * @interface Project
 * @property {string} language_id - Language server identifier
 * @property {string} project - Project name within language server
 */
interface Project {
  language_id: string;
  project: string;
}

/**
 * Text range definition with file context
 * 
 * @interface Range
 * @property {number} end_character - Zero-based ending character position
 * @property {number} end_line - Zero-based ending line number
 * @property {string} file_path - Absolute or relative path to target file
 * @property {number} start_character - Zero-based starting character position
 * @property {number} start_line - Zero-based starting line number
 */
interface Range {
  end_character: number;
  end_line: number;
  file_path: string;
  start_character: number;
  start_line: number;
}

/**
 * Generic resolve operation parameters with typed item
 * 
 * @interface Resolve
 * @template TItem - Type of item being resolved
 * @property {string} file_path - File path context for resolution
 * @property {TItem} item - Item to resolve additional details for
 */
interface Resolve<TItem = unknown> {
  file_path: string;
  item: TItem;
}

/**
 * Parameters for server restart operations
 * 
 * @interface RestartServer
 * @extends LanguageId
 * @property {string} project - Project name to restart server with
 */
interface RestartServer extends LanguageId {
  project: string;
}

/**
 * Server runtime status information
 * 
 * @interface ServerStatus
 * @property {'error' | 'ready' | 'starting' | 'stopped' | 'unconfigured'} status - Current server state
 * @property {string} uptime - Server uptime in milliseconds
 * @property {string} [error] - Error message if status is 'error'
 * @property {string} [languageId] - Language server identifier
 * @property {number} [pid] - Process ID if server is running
 * @property {string} [project] - Project name if server is running
 */
interface ServerStatus {
  status: 'error' | 'ready' | 'starting' | 'stopped' | 'unconfigured';
  uptime: string;
  error?: string;
  languageId?: string;
  pid?: number;
  project?: string;
}

/**
 * Mapping between LSP capabilities, tool handlers, and MCP tool definitions
 * 
 * @interface ServerTools
 * @property {string} capability - LSP server capability name (e.g., 'hoverProvider')
 * @property {ToolHandler<any>} handler - Async handler function for tool execution
 * @property {Tool} tool - MCP tool definition with schema and metadata
 */
interface ServerTools {
  capability: string;
  handler: ToolHandler<any>;
  tool: Tool;
}

/**
 * Parameters for server start operations
 * 
 * @interface StartServer
 * @extends LanguageId
 * @property {string} [project] - Optional project name to start server with
 */
interface StartServer extends LanguageId {
  project?: string;
}

/**
 * Parameters for server stop operations
 * 
 * @interface StopServer
 * @extends LanguageId
 */
interface StopServer extends LanguageId { }

/**
 * Tools organized by capability with support status
 * 
 * @interface SupportedTools
 * @property {boolean} supported - Whether this capability is supported
 * @property {Tool[]} tools - Array of tools for this capability
 */
interface SupportedTools {
  supported: boolean;
  tools: Tool[];
}

/**
 * Capability to tool definition mapping
 * 
 * @interface ToolCapabilities
 * @property {string} capability - LSP server capability name
 * @property {Tool} tool - Corresponding MCP tool definition
 */
interface ToolCapabilities {
  capability: string;
  tool: Tool;
}

/**
 * Generic tool handler function type
 * 
 * @template TArgs - Type of arguments passed to handler
 * @param {TArgs} args - Tool execution arguments
 * @returns {Promise<unknown>} Promise resolving to tool execution result
 */
type ToolHandler<TArgs = unknown> = (args: TArgs) => Promise<unknown>;

/**
 * MCP Server implementation bridging LSP servers with Model Context Protocol
 * 
 * Provides a comprehensive interface for language server operations through MCP tools,
 * managing server lifecycle, request routing, and capability-based tool exposure.
 * 
 * @class McpServer
 */
export class McpServer {
  private client: Client;
  private config: Config;
  private limit: number;
  private logger: Logger;
  private query: string;
  private server: Server;
  private tool: McpTool;
  private toolHandler: Map<string, ToolHandler>;
  private transport?: StdioServerTransport;

  /**
   * Creates a new McpServer instance with configuration and tool setup
   * 
   * Initializes client, config, MCP server, and tool registry.
   * Sets up handler mappings and prepares for transport connection.
   * 
   * @param {string} configPath - Path to the LSP configuration JSON file
   */
  constructor(configPath: string) {
    this.limit = 250;
    this.query = '';
    this.server = new Server(
      { name: 'mcp-lsp', version: Client.version() },
      { capabilities: { logging: {}, tools: {} } }
    );
    this.config = Config.validate(configPath);
    this.logger = new Logger(this.config, this.server);
    this.client = new Client(this.config, this.logger, this.query);
    this.tool = new McpTool(this.limit, this.query);
    this.toolHandler = new Map<string, ToolHandler>();
    this.setupToolHandlers();
    this.setupHandlers();
  }

  /**
   * Generates capability-based tools map for MCP tool exposure
   * 
   * Maps LSP server capabilities to available MCP tools, creating a dynamic
   * tool registry based on what the current language server actually supports.
   * 
   * @private
   * @param {ServerCapabilities} capabilities - LSP server capabilities from initialization
   * @param {ToolCapabilities[]} toolCapabilities - Available tool-to-capability mappings
   * @returns {Record<string, SupportedTools>} Capability-keyed mapping of supported tools
   */
  private generateToolsMap(capabilities: ServerCapabilities, toolCapabilities: ToolCapabilities[]): Record<string, SupportedTools> {
    const server = new Map<string, Tool[]>();
    const toolsMap: Record<string, SupportedTools> = {};
    for (const { tool, capability } of toolCapabilities) {
      if (!server.has(capability)) {
        server.set(capability, []);
      }
      server.get(capability)!.push(tool);
    }
    for (const [capability, value] of Object.entries(capabilities)) {
      if (value) {
        if (server.has(capability)) {
          const tools = server.get(capability)!;
          toolsMap[capability] = { supported: true, tools };
        } else {
          toolsMap[capability] = { supported: false, tools: [] };
        }
      }
    }
    const serverOperations = server.get('serverOperations');
    if (serverOperations && serverOperations.length) {
      toolsMap['serverOperations'] = { supported: true, tools: serverOperations };
    }
    return toolsMap;
  }

  /**
   * Prepares call hierarchy for symbol at cursor position
   * 
   * Initiates call hierarchy analysis to enable caller/callee relationship exploration.
   * 
   * @private
   * @param {GetCallHierarchy} args - Position and file context for hierarchy preparation
   * @returns {Promise<CallHierarchyItem[] | string>} Array of call hierarchy items or error message
   */
  private async getCallHierarchy(args: GetCallHierarchy): Promise<unknown> {
    const error = this.validate(args, ['file_path', 'character', 'line']);
    if (error) {
      return error;
    }
    const params: CallHierarchyPrepareParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, CallHierarchyPrepareRequest.method, params);
  }

  /**
   * Retrieves code actions and quick fixes at cursor position
   * 
   * Requests automated refactoring suggestions, error fixes, and code improvements
   * from language server diagnostics.
   * 
   * @private
   * @param {GetCodeActions} args - Position and file context for code action discovery
   * @returns {Promise<CodeAction[] | string>} Array of available code actions or error message
   */
  private async getCodeActions(args: GetCodeActions): Promise<unknown> {
    const error = this.validate(args, ['file_path', 'character', 'line']);
    if (error) {
      return error;
    }
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
   * Resolves additional details for a code action item
   * 
   * Fetches complete edit operations, command details, and workspace changes
   * for a previously retrieved code action.
   * 
   * @private
   * @param {GetCodeResolves} args - File context and code action item to resolve
   * @returns {Promise<CodeAction | string>} Resolved code action with full details or error message
   */
  private async getCodeResolves(args: GetCodeResolves): Promise<unknown> {
    const error = this.validate(args, ['file_path', 'item']);
    if (error) {
      return error;
    }
    return await this.client.sendServerRequest(args.file_path, CodeActionResolveRequest.method, args.item);
  }

  /**
   * Extracts color definitions and references from document
   * 
   * Identifies color values (hex, rgb, hsl) and their locations for color picker integration.
   * 
   * @private
   * @param {GetColors} args - File path for color extraction
   * @returns {Promise<ColorInformation[] | string>} Array of color information or error message
   */
  private async getColors(args: GetColors): Promise<unknown> {
    const error = this.validate(args, ['file_path']);
    if (error) {
      return error;
    }
    const params = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DocumentColorRequest.method, params);
  }

  /**
   * Retrieves code completions and IntelliSense suggestions at cursor position
   * 
   * Provides context-aware code completion including symbols, keywords, snippets,
   * and documentation for enhanced developer productivity.
   * 
   * @private
   * @param {GetCompletions} args - Position and file context for completion discovery
   * @returns {Promise<CompletionItem[] | string>} Array of completion suggestions or error message
   */
  private async getCompletions(args: GetCompletions): Promise<unknown> {
    const error = this.validate(args, ['file_path', 'character', 'line']);
    if (error) {
      return error;
    }
    const timer = Date.now();
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    const fullResult = await this.client.sendServerRequest(args.file_path, CompletionRequest.method, params);
    if (typeof fullResult === 'string' || !Array.isArray(fullResult)) {
      return this.client.response(fullResult);
    }
    const description = `Showing completions for '${args.file_path}' file.`;
    const elapsed = Date.now() - timer;
    return this.paginatedResponse(fullResult, args, description, {
      file_path: args.file_path,
      time: `${elapsed}ms`
    });
  }

  /**
   * Extracts diagnostics from document
   * 
   * Identifies errors, warnings, and info messages for code quality
   * analysis and validation feedback.
   * 
   * @private
   * @param {GetDiagnostics} args - File path for diagnostic extraction
   * @returns {Promise<Diagnostic[] | string>} Array of diagnostics or error message
   */
  private async getDiagnostics(args: GetDiagnostics): Promise<unknown> {
    const error = this.validate(args, ['file_path']);
    if (error) {
      return error;
    }
    const params = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DocumentDiagnosticRequest.method, params);
  }

  /**
   * Identifies collapsible code sections for editor folding
   * 
   * Analyzes document structure to find foldable regions like functions,
   * classes, blocks, and comments for improved code navigation.
   * 
   * @private
   * @param {GetFoldingRanges} args - File path for folding range analysis
   * @returns {Promise<FoldingRange[] | string>} Array of foldable ranges or error message
   */
  private async getFoldingRanges(args: GetFoldingRanges): Promise<unknown> {
    const error = this.validate(args, ['file_path']);
    if (error) {
      return error;
    }
    const params = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, FoldingRangeRequest.method, params);
  }

  /**
   * Formats entire document according to language server style rules
   * 
   * Applies consistent formatting using configured style guidelines including
   * indentation, spacing, and language-specific formatting conventions.
   * 
   * @private
   * @param {GetFormat} args - File path for document formatting
   * @returns {Promise<TextEdit[] | string>} Array of text edits for formatting or error message
   */
  private async getFormat(args: GetFormat): Promise<unknown> {
    const error = this.validate(args, ['file_path']);
    if (error) {
      return error;
    }
    const params = {
      options: { tabSize: 2, insertSpaces: true },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DocumentFormattingRequest.method, params);
  }

  /**
   * Highlights all occurrences of symbol at cursor position
   * 
   * Finds and highlights all references to the symbol under cursor
   * for visual identification and navigation assistance.
   * 
   * @private
   * @param {GetHighlights} args - Position and file context for symbol highlighting
   * @returns {Promise<DocumentHighlight[] | string>} Array of highlight ranges or error message
   */
  private async getHighlights(args: GetHighlights): Promise<unknown> {
    const error = this.validate(args, ['file_path', 'character', 'line']);
    if (error) {
      return error;
    }
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DocumentHighlightRequest.method, params);
  }

  /**
   * Retrieves hover information and documentation at cursor position
   * 
   * Provides type information, documentation, and contextual details
   * for symbols, functions, and variables under the cursor.
   * 
   * @private
   * @param {GetHover} args - Position and file context for hover information
   * @returns {Promise<Hover | string>} Hover content with documentation or error message
   */
  private async getHover(args: GetHover): Promise<unknown> {
    const error = this.validate(args, ['file_path', 'character', 'line']);
    if (error) {
      return error;
    }
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, HoverRequest.method, params);
  }

  /**
   * Finds all implementations of interface or abstract method at cursor
   * 
   * Locates concrete implementations of abstract methods, interface methods,
   * or virtual functions for navigation and analysis.
   * 
   * @private
   * @param {GetImplementations} args - Position and file context for implementation search
   * @returns {Promise<Location[] | string>} Array of implementation locations or error message
   */
  private async getImplementations(args: GetImplementations): Promise<unknown> {
    const error = this.validate(args, ['file_path', 'character', 'line']);
    if (error) {
      return error;
    }
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, ImplementationRequest.method, params);
  }

  /**
   * Retrieves all functions that call the specified symbol
   * 
   * Analyzes call hierarchy to find all callers of a function or method,
   * enabling reverse dependency analysis and code navigation.
   * 
   * @private
   * @param {GetIncomingCalls} args - Call hierarchy item to find callers for
   * @returns {Promise<CallHierarchyIncomingCall[] | string>} Array of incoming calls or error message
   */
  private async getIncomingCalls(args: GetIncomingCalls): Promise<unknown> {
    const error = this.validate(args, ['item']);
    if (error) {
      return error;
    }
    const params: CallHierarchyIncomingCallsParams = {
      item: args.item
    };
    const filePath = this.setFilePath(args.item);
    return await this.client.sendServerRequest(filePath, CallHierarchyIncomingCallsRequest.method, params);
  }

  /**
   * Resolves additional details for an inlay hint item
   * 
   * Fetches complete information for inlay hints including tooltips,
   * click actions, and extended documentation.
   * 
   * @private
   * @param {GetInlayHint} args - File context and inlay hint item to resolve
   * @returns {Promise<InlayHint | string>} Resolved inlay hint with full details or error message
   */
  private async getInlayHint(args: GetInlayHint): Promise<unknown> {
    const error = this.validate(args, ['file_path', 'item']);
    if (error) {
      return error;
    }
    return await this.client.sendServerRequest(args.file_path, InlayHintResolveRequest.method, args.item);
  }

  /**
   * Retrieves inline type annotations and parameter hints for code range
   * 
   * Provides visual type hints, parameter names, and return types
   * directly in the editor for improved code readability.
   * 
   * @private
   * @param {GetInlayHints} args - Range and file context for hint analysis
   * @returns {Promise<InlayHint[] | string>} Array of inlay hints or error message
   */
  private async getInlayHints(args: GetInlayHints): Promise<unknown> {
    const error = this.validate(args, ['end_character', 'end_line', 'file_path', 'start_character', 'start_line']);
    if (error) {
      return error;
    }
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
   * Finds related ranges that should be edited simultaneously
   * 
   * Identifies linked editing ranges where changes to one location
   * should automatically apply to related locations (e.g., HTML tag pairs).
   * 
   * @private
   * @param {GetLinkedEditingRange} args - Position and file context for linked range discovery
   * @returns {Promise<LinkedEditingRanges | string>} Linked editing ranges or error message
   */
  private async getLinkedEditingRange(args: GetLinkedEditingRange): Promise<unknown> {
    const error = this.validate(args, ['character', 'file_path', 'line']);
    if (error) {
      return error;
    }
    const params: LinkedEditingRangeParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, LinkedEditingRangeRequest.method, params);
  }

  /**
   * Resolves target URL for a document link item
   * 
   * Fetches the actual target URL for clickable links within documents,
   * enabling navigation to external resources and file references.
   * 
   * @private
   * @param {GetLinkResolves} args - File context and document link item to resolve
   * @returns {Promise<DocumentLink | string>} Resolved document link with target or error message
   */
  private async getLinkResolves(args: GetLinkResolves): Promise<unknown> {
    const error = this.validate(args, ['file_path', 'item']);
    if (error) {
      return error;
    }
    return await this.client.sendServerRequest(args.file_path, DocumentLinkResolveRequest.method, args.item);
  }

  /**
   * Extracts clickable links and references from document
   * 
   * Scans document for URLs, file references, and other clickable links
   * that can be navigated or opened in external applications.
   * 
   * @private
   * @param {GetLinks} args - File path for link extraction
   * @returns {Promise<DocumentLink[] | string>} Array of document links or error message
   */
  private async getLinks(args: GetLinks): Promise<unknown> {
    const error = this.validate(args, ['file_path']);
    if (error) {
      return error;
    }
    const params = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DocumentLinkRequest.method, params);
  }

  /**
   * Retrieves all functions called by the specified symbol
   * 
   * Analyzes call hierarchy to find all functions or methods called
   * from the current symbol, enabling dependency analysis.
   * 
   * @private
   * @param {GetOutgoingCalls} args - Call hierarchy item to find callees for
   * @returns {Promise<CallHierarchyOutgoingCall[] | string>} Array of outgoing calls or error message
   */
  private async getOutgoingCalls(args: GetOutgoingCalls): Promise<unknown> {
    const error = this.validate(args, ['item']);
    if (error) {
      return error;
    }
    const params: CallHierarchyOutgoingCallsParams = {
      item: args.item
    };
    const filePath = this.setFilePath(args.item);
    return await this.client.sendServerRequest(filePath, CallHierarchyOutgoingCallsRequest.method, params);
  }

  /**
   * Lists all files in the project workspace with pagination
   * 
   * Retrieves cached project files discovered during server initialization,
   * with pagination support for large codebases and project path information.
   * 
   * @private
   * @param {GetProjectFiles} args - Project identification and pagination parameters
   * @returns {Promise<{data: {files: string[], path: string}, pagination: PageMetadata} | string>} Paginated file listing or error message
   */
  private async getProjectFiles(args: GetProjectFiles): Promise<unknown> {
    const error = this.validate(args, ['language_id', 'project']);
    if (error) {
      return error;
    }
    if (args.project !== this.client.getProjectId(args.language_id)) {
      return `Language server '${args.language_id}' for project '${args.project}' is not running.`;
    }
    const serverConfig = this.config.getServerConfig(args.language_id);
    const projectConfig = serverConfig.projects.find(id => id.name === args.project) as { name: string, path: string };
    const files = await this.client.getProjectFiles(args.language_id, args.project);
    if (!files) {
      return `No files found for '${args.project}' project in '${args.language_id}' language server.`;
    }
    const description = `Showing files for '${args.project}' project.`;
    return this.paginatedResponse(files, args, description, {
      language_id: args.language_id,
      project: args.project,
      path: projectConfig.path
    });
  }

  /**
   * Searches for symbols across entire project workspace with pagination
   * 
   * Performs project-wide symbol search using workspace symbol provider,
   * with pagination support for large result sets and comprehensive metadata.
   * 
   * @private
   * @param {GetProjectSymbols} args - Project identification and search parameters
   * @returns {Promise<{data: {symbols: WorkspaceSymbol[]}, pagination: PageMetadata} | string>} Paginated symbol results or error message
   */
  private async getProjectSymbols(args: GetProjectSymbols): Promise<unknown> {
    const error = this.validate(args, ['language_id', 'project', 'query']);
    if (error) {
      return error;
    }
    const timer = Date.now();
    if (args.project !== this.client.getProjectId(args.language_id)) {
      return `Language server '${args.language_id}' for project '${args.project}' is not running.`;
    }
    await this.client.loadProjectFiles(args.language_id, args.project, args.timeout);
    const params: WorkspaceSymbolParams = { query: args.query ?? this.query };
    const result = await this.client.sendRequest(args.language_id, args.project, WorkspaceSymbolRequest.method, params);
    if (typeof result === 'string' || !Array.isArray(result)) {
      return this.client.response(result);
    }
    const description = `Showing project symbols for '${args.project}' project.`;
    const elapsed = Date.now() - timer;
    return this.paginatedResponse(result, args, description, {
      language_id: args.language_id,
      project: args.project,
      query: args.query,
      time: `${elapsed}ms`
    });
  }

  /**
   * Formats specific code range according to language server style rules
   * 
   * Applies formatting to a selected text range while preserving
   * surrounding code structure and maintaining consistent style.
   * 
   * @private
   * @param {GetRangeFormat} args - Range and file context for targeted formatting
   * @returns {Promise<TextEdit[] | string>} Array of text edits for range formatting or error message
   */
  private async getRangeFormat(args: GetRangeFormat): Promise<unknown> {
    const error = this.validate(args, ['end_character', 'end_line', 'file_path', 'start_character', 'start_line']);
    if (error) {
      return error;
    }
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
   * Resolves additional details for a completion item
   * 
   * Fetches extended information for completion items including documentation,
   * additional text edits, and detailed type information.
   * 
   * @private
   * @param {GetResolves} args - File context and completion item to resolve
   * @returns {Promise<CompletionItem | string>} Resolved completion item with full details or error message
   */
  private async getResolves(args: GetResolves): Promise<unknown> {
    const error = this.validate(args, ['file_path', 'item']);
    if (error) {
      return error;
    }
    const params = {
      ...args.item,
      uri: `file://${args.file_path}`
    };
    return await this.client.sendServerRequest(args.file_path, CompletionResolveRequest.method, params);
  }

  /**
   * Expands selection to logical code boundaries
   * 
   * Intelligently expands text selection to encompass logical code units
   * like expressions, statements, blocks, and functions.
   * 
   * @private
   * @param {GetSelectionRange} args - Position and file context for selection expansion
   * @returns {Promise<SelectionRange[] | string>} Array of expanded selection ranges or error message
   */
  private async getSelectionRange(args: GetSelectionRange): Promise<unknown> {
    const error = this.validate(args, ['character', 'file_path', 'line']);
    if (error) {
      return error;
    }
    const params: SelectionRangeParams = {
      positions: [{ character: args.character, line: args.line }],
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, SelectionRangeRequest.method, params);
  }

  /**
   * Extracts detailed syntax tokens for advanced highlighting and analysis
   * 
   * Provides semantic token information for enhanced syntax highlighting,
   * including token types, modifiers, and positional data.
   * 
   * @private
   * @param {GetSemanticTokens} args - File path for semantic token analysis
   * @returns {Promise<SemanticTokens | string>} Semantic token data or error message
   */
  private async getSemanticTokens(args: GetSemanticTokens): Promise<unknown> {
    const error = this.validate(args, ['file_path']);
    if (error) {
      return error;
    }
    const params: SemanticTokensParams = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, SemanticTokensRequest.method, params);
  }

  /**
   * Gets language server capabilities and available tool mappings
   * 
   * Retrieves LSP server capabilities and maps them to available MCP tools,
   * providing comprehensive capability inspection and tool discovery.
   * 
   * @private
   * @param {GetServerCapabilities} args - Language server identification
   * @param {ToolCapabilities[]} [toolCapabilities] - Optional pre-computed tool capabilities
   * @returns {Promise<{capabilities: ServerCapabilities, tools: Record<string, SupportedTools>} | string>} Server capabilities and tools or error message
   */
  private async getServerCapabilities(args: GetServerCapabilities, toolCapabilities?: ToolCapabilities[]): Promise<unknown> {
    const error = this.validate(args, ['language_id']);
    if (error) {
      return error;
    }
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
    if (!toolCapabilities) {
      toolCapabilities = this.setServerTools().map(({ tool, capability }) => ({ tool, capability }));
    }
    const tools = this.generateToolsMap(capabilities, toolCapabilities);
    return { language_id: args.language_id, project, capabilities, tools };
  }

  /**
   * Lists all configured projects for a language server
   * 
   * Retrieves project configurations including paths, extensions, and settings
   * for all projects associated with the specified language server.
   * 
   * @private
   * @param {GetServerProjects} args - Language server identification
   * @returns {Promise<ProjectConfig[] | string>} Array of project configurations or error message
   */
  private async getServerProjects(args: GetServerProjects): Promise<unknown> {
    const error = this.validate(args, ['language_id']);
    if (error) {
      return error;
    }
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
   * Gets runtime status of language servers
   * 
   * Provides detailed status information including process state, uptime,
   * project associations, and error conditions for monitoring and debugging.
   * 
   * @private
   * @param {GetServerStatus} args - Optional language server filter
   * @returns {Promise<ServerStatus | Record<string, ServerStatus>>} Server status or status map for all servers
   */
  private async getServerStatus(args: GetServerStatus): Promise<ServerStatus | Record<string, ServerStatus>> {
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
   * Shows function parameters and signature help at cursor position
   * 
   * Provides function signature information, parameter details, and overload
   * information to assist with function calls and method invocations.
   * 
   * @private
   * @param {GetSignature} args - Position and file context for signature help
   * @returns {Promise<SignatureHelp | string>} Signature help information or error message
   */
  private async getSignature(args: GetSignature): Promise<unknown> {
    const error = this.validate(args, ['character', 'file_path', 'line']);
    if (error) {
      return error;
    }
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, SignatureHelpRequest.method, params);
  }

  /**
   * Finds all subtypes that inherit from the specified type
   * 
   * Analyzes type hierarchy to discover derived classes, implementing types,
   * and subtypes for inheritance analysis and navigation.
   * 
   * @private
   * @param {GetSubtypes} args - Type hierarchy item to find subtypes for
   * @returns {Promise<TypeHierarchyItem[] | string>} Array of subtype items or error message
   */
  private async getSubtypes(args: GetSubtypes): Promise<unknown> {
    const error = this.validate(args, ['item']);
    if (error) {
      return error;
    }
    const params: TypeHierarchySubtypesParams = {
      item: args.item
    };
    const filePath = this.setFilePath(args.item);
    return await this.client.sendServerRequest(filePath, TypeHierarchySubtypesRequest.method, params);
  }

  /**
   * Finds all parent types that the specified type inherits from
   * 
   * Analyzes type hierarchy to discover base classes, implemented interfaces,
   * and supertypes for inheritance analysis and navigation.
   * 
   * @private
   * @param {GetSupertypes} args - Type hierarchy item to find supertypes for
   * @returns {Promise<TypeHierarchyItem[] | string>} Array of supertype items or error message
   */
  private async getSupertypes(args: GetSupertypes): Promise<unknown> {
    const error = this.validate(args, ['item']);
    if (error) {
      return error;
    }
    const params: TypeHierarchySupertypesParams = {
      item: args.item
    };
    const filePath = this.setFilePath(args.item);
    return await this.client.sendServerRequest(filePath, TypeHierarchySupertypesRequest.method, params);
  }

  /**
   * Navigates to where symbol is originally defined
   * 
   * Locates the primary definition of symbols, functions, classes, or variables
   * for precise navigation to declaration sites.
   * 
   * @private
   * @param {GetSymbolDefinitions} args - Position and file context for definition lookup
   * @returns {Promise<Location[] | string>} Array of definition locations or error message
   */
  private async getSymbolDefinitions(args: GetSymbolDefinitions): Promise<unknown> {
    const error = this.validate(args, ['character', 'file_path', 'line']);
    if (error) {
      return error;
    }
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DefinitionRequest.method, params);
  }

  /**
   * Finds all locations where symbol is used or referenced
   * 
   * Searches for all usages of a symbol throughout the workspace,
   * with optional inclusion of the symbol's declaration site.
   * 
   * @private
   * @param {GetSymbolReferences} args - Position, file context, and declaration inclusion settings
   * @returns {Promise<Location[] | string>} Array of reference locations or error message
   */
  private async getSymbolReferences(args: GetSymbolReferences): Promise<unknown> {
    const error = this.validate(args, ['character', 'file_path', 'line']);
    if (error) {
      return error;
    }
    const params: ReferenceParams = {
      context: { includeDeclaration: args.include_declaration ?? true },
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, ReferencesRequest.method, params);
  }

  /**
   * Previews all locations that would be renamed with symbol
   * 
   * Generates a preview of all code locations that would be affected
   * by a symbol rename operation for review before execution.
   * 
   * @private
   * @param {GetSymbolRenames} args - Position, file context, and new symbol name
   * @returns {Promise<WorkspaceEdit | string>} Workspace edit with rename changes or error message
   */
  private async getSymbolRenames(args: GetSymbolRenames): Promise<unknown> {
    const error = this.validate(args, ['character', 'file_path', 'line', 'new_name']);
    if (error) {
      return error;
    }
    const params: RenameParams = {
      newName: args.new_name,
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, RenameRequest.method, params);
  }

  /**
   * Lists all symbols in document with pagination
   * 
   * Extracts document outline including functions, classes, variables,
   * and other symbols with hierarchical structure and pagination support.
   * 
   * @private
   * @param {GetSymbols} args - File path and pagination parameters
   * @returns {Promise<{data: {symbols: DocumentSymbol[]}, pagination: PageMetadata} | string>} Paginated symbol listing or error message
   */
  private async getSymbols(args: GetSymbols): Promise<unknown> {
    const error = this.validate(args, ['file_path']);
    if (error) {
      return error;
    }
    const timer = Date.now();
    const params = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    const fullResult = await this.client.sendServerRequest(args.file_path, DocumentSymbolRequest.method, params);
    if (typeof fullResult === 'string' || !Array.isArray(fullResult)) {
      return this.client.response(fullResult);
    }
    const description = `Showing document symbols for '${args.file_path}' file.`;
    const elapsed = Date.now() - timer;
    return this.paginatedResponse(fullResult, args, description, {
      file_path: args.file_path,
      time: `${elapsed}ms`
    });
  }

  /**
   * Navigates to where symbol type is defined
   * 
   * Locates the definition of a symbol's type rather than the symbol itself,
   * useful for understanding data types and class definitions.
   * 
   * @private
   * @param {GetTypeDefinitions} args - Position and file context for type definition lookup
   * @returns {Promise<Location[] | string>} Array of type definition locations or error message
   */
  private async getTypeDefinitions(args: GetTypeDefinitions): Promise<unknown> {
    const error = this.validate(args, ['character', 'file_path', 'line']);
    if (error) {
      return error;
    }
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, TypeDefinitionRequest.method, params);
  }

  /**
   * Builds type hierarchy showing inheritance relationships
   * 
   * Prepares type hierarchy analysis to enable exploration of inheritance
   * chains and type relationships in object-oriented code.
   * 
   * @private
   * @param {GetTypeHierarchy} args - Position and file context for type hierarchy preparation
   * @returns {Promise<TypeHierarchyItem[] | string>} Array of type hierarchy items or error message
   */
  private async getTypeHierarchy(args: GetTypeHierarchy): Promise<unknown> {
    const error = this.validate(args, ['character', 'file_path', 'line']);
    if (error) {
      return error;
    }
    const params: TypeHierarchyPrepareParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, TypeHierarchyPrepareRequest.method, params);
  }

  /**
   * Handles tool execution requests from MCP clients
   * 
   * Routes incoming MCP tool requests to appropriate handler functions,
   * validates arguments, and formats responses for MCP protocol compliance.
   * 
   * @private
   * @param {CallToolRequest} request - MCP tool execution request with name and arguments
   * @returns {Promise<Response>} MCP-compliant response with execution results
   */
  private async handleRequest(request: CallToolRequest): Promise<Response> {
    if (!request.params.arguments) {
      return this.client.response('No arguments provided');
    }
    const handler = this.toolHandler.get(request.params.name);
    if (!handler) {
      return this.client.response(`Unknown tool: ${request.params.name}`);
    }
    const result = await handler(request.params.arguments);
    return this.client.response(result, typeof result === 'string' ? false : true);
  }

  /**
   * Handles tool listing requests from MCP clients
   * 
   * Returns complete list of available MCP tools with their schemas
   * and descriptions for client capability discovery.
   * 
   * @private
   * @returns {Promise<{tools: Tool[]}>} Complete tool registry for MCP protocol
   */
  private async handleTools(): Promise<{ tools: Tool[] }> {
    return { tools: this.tool.getTools() };
  }

  /**
   * Creates a paginated MCP response with standardized pagination metadata
   * 
   * @private
   * @template T - Type of items being paginated
   * @param {T[]} items - Array of items to paginate
   * @param {object} args - Pagination arguments with limit and offset
   * @param {string} description - Descriptive message for the response
   * @param {Record<string, unknown>} [data] - Optional additional data to include in response
   * @returns {Response} MCP-compliant paginated response with data and pagination metadata
   */
  private paginatedResponse<T>(items: T[], args: { limit?: number; offset?: number }, description: string, data?: Record<string, unknown>): Response {
    const limit = args.limit ?? this.limit;
    const offset = args.offset ?? 0;
    const total = items.length;
    const paginatedItems = items.slice(offset, offset + limit);
    const more = offset + limit < total;
    const response = { ...data, items: paginatedItems };
    const pagination = { more, offset, total };
    return this.client.response(description, false, { response, pagination });
  }

  /**
   * Restarts language server with specified project
   * 
   * Stops current server instance and starts fresh with new or same project,
   * useful for configuration changes or error recovery.
   * 
   * @private
   * @param {RestartServer} args - Language server and project identification
   * @returns {Promise<Response | string>} Restart result with timing information or error message
   */
  private async restartServer(args: RestartServer): Promise<unknown> {
    const error = this.validate(args, ['language_id', 'project']);
    if (error) {
      return error;
    }
    return await this.client.restartServer(args.language_id, args.project);
  }

  /**
   * Extracts file path from URI and validates presence
   * 
   * Converts 'file://' URIs to local file paths for language server communication.
   * Returns error message if URI is missing or malformed.
   * 
   * @private
   * @param {{name: string, uri?: string}} item - Object with name and optional URI property
   * @returns {string} File path without 'file://' prefix or error message
   */
  private setFilePath(item: { name: string, uri?: string }): string {
    if (!item.uri) {
      return `Invalid '${item.name}' item: missing URI`;
    }
    return item.uri.replace('file://', '');
  }

  /**
   * Maps LSP server capabilities to corresponding MCP tools
   * 
   * Creates comprehensive mapping between LSP capabilities and MCP tool handlers,
   * enabling dynamic tool availability based on server features.
   * 
   * @private
   * @returns {ServerTools[]} Array of capability-to-tool-handler mappings
   */
  private setServerTools(): ServerTools[] {
    return [
      { capability: 'callHierarchyProvider', handler: this.getCallHierarchy.bind(this), tool: this.tool.getCallHierarchy() },
      { capability: 'codeActionProvider', handler: this.getCodeActions.bind(this), tool: this.tool.getCodeActions() },
      { capability: 'codeActionProvider', handler: this.getCodeResolves.bind(this), tool: this.tool.getCodeResolves() },
      { capability: 'colorProvider', handler: this.getColors.bind(this), tool: this.tool.getColors() },
      { capability: 'completionProvider', handler: this.getCompletions.bind(this), tool: this.tool.getCompletions() },
      { capability: 'diagnosticProvider', handler: this.getDiagnostics.bind(this), tool: this.tool.getDiagnostics() },
      { capability: 'foldingRangeProvider', handler: this.getFoldingRanges.bind(this), tool: this.tool.getFoldingRanges() },
      { capability: 'documentFormattingProvider', handler: this.getFormat.bind(this), tool: this.tool.getFormat() },
      { capability: 'documentHighlightProvider', handler: this.getHighlights.bind(this), tool: this.tool.getHighlights() },
      { capability: 'hoverProvider', handler: this.getHover.bind(this), tool: this.tool.getHover() },
      { capability: 'implementationProvider', handler: this.getImplementations.bind(this), tool: this.tool.getImplementations() },
      { capability: 'callHierarchyProvider', handler: this.getIncomingCalls.bind(this), tool: this.tool.getIncomingCalls() },
      { capability: 'inlayHintProvider', handler: this.getInlayHint.bind(this), tool: this.tool.getInlayHint() },
      { capability: 'inlayHintProvider', handler: this.getInlayHints.bind(this), tool: this.tool.getInlayHints() },
      { capability: 'linkedEditingRangeProvider', handler: this.getLinkedEditingRange.bind(this), tool: this.tool.getLinkedEditingRange() },
      { capability: 'documentLinkProvider', handler: this.getLinkResolves.bind(this), tool: this.tool.getLinkResolves() },
      { capability: 'documentLinkProvider', handler: this.getLinks.bind(this), tool: this.tool.getLinks() },
      { capability: 'callHierarchyProvider', handler: this.getOutgoingCalls.bind(this), tool: this.tool.getOutgoingCalls() },
      { capability: 'serverOperations', handler: this.getProjectFiles.bind(this), tool: this.tool.getProjectFiles() },
      { capability: 'workspaceSymbolProvider', handler: this.getProjectSymbols.bind(this), tool: this.tool.getProjectSymbols() },
      { capability: 'documentRangeFormattingProvider', handler: this.getRangeFormat.bind(this), tool: this.tool.getRangeFormat() },
      { capability: 'completionProvider', handler: this.getResolves.bind(this), tool: this.tool.getResolves() },
      { capability: 'selectionRangeProvider', handler: this.getSelectionRange.bind(this), tool: this.tool.getSelectionRange() },
      { capability: 'semanticTokensProvider', handler: this.getSemanticTokens.bind(this), tool: this.tool.getSemanticTokens() },
      { capability: 'serverOperations', handler: this.getServerCapabilities.bind(this), tool: this.tool.getServerCapabilities() },
      { capability: 'serverOperations', handler: this.getServerProjects.bind(this), tool: this.tool.getServerProjects() },
      { capability: 'serverOperations', handler: this.getServerStatus.bind(this), tool: this.tool.getServerStatus() },
      { capability: 'signatureHelpProvider', handler: this.getSignature.bind(this), tool: this.tool.getSignature() },
      { capability: 'typeHierarchyProvider', handler: this.getSubtypes.bind(this), tool: this.tool.getSubtypes() },
      { capability: 'typeHierarchyProvider', handler: this.getSupertypes.bind(this), tool: this.tool.getSupertypes() },
      { capability: 'definitionProvider', handler: this.getSymbolDefinitions.bind(this), tool: this.tool.getSymbolDefinitions() },
      { capability: 'referencesProvider', handler: this.getSymbolReferences.bind(this), tool: this.tool.getSymbolReferences() },
      { capability: 'renameProvider', handler: this.getSymbolRenames.bind(this), tool: this.tool.getSymbolRenames() },
      { capability: 'documentSymbolProvider', handler: this.getSymbols.bind(this), tool: this.tool.getSymbols() },
      { capability: 'typeDefinitionProvider', handler: this.getTypeDefinitions.bind(this), tool: this.tool.getTypeDefinitions() },
      { capability: 'typeHierarchyProvider', handler: this.getTypeHierarchy.bind(this), tool: this.tool.getTypeHierarchy() },
      { capability: 'serverOperations', handler: this.restartServer.bind(this), tool: this.tool.restartServer() },
      { capability: 'serverOperations', handler: this.startServer.bind(this), tool: this.tool.startServer() },
      { capability: 'serverOperations', handler: this.stopServer.bind(this), tool: this.tool.stopServer() }
    ];
  }

  /**
   * Sets up MCP request handlers for tool operations
   * 
   * Configures request handlers for CallToolRequest and ListToolsRequest
   * to enable MCP client communication and tool discovery.
   * 
   * @private
   */
  private setupHandlers(): void {
    this.server.setRequestHandler(CallToolRequestSchema, this.handleRequest.bind(this));
    this.server.setRequestHandler(ListToolsRequestSchema, this.handleTools.bind(this));
  }

  /**
   * Sets up tool handlers registry with argument processing
   * 
   * Registers all tool handlers with argument validation and default value injection,
   * creating wrapped handlers that process MCP arguments before execution.
   * 
   * @private
   */
  private setupToolHandlers(): void {
    const tools = this.setServerTools();
    for (const { tool, handler } of tools) {
      const wrappedHandler: ToolHandler = async (args: unknown) => {
        const processedArgs = args as Record<string, unknown>;
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
   * Starts a language server for specified language and project
   * 
   * Initializes new language server instance with project configuration,
   * enabling LSP features for the target codebase.
   * 
   * @private
   * @param {StartServer} args - Language server and optional project identification
   * @returns {Promise<Response | string>} Startup result with server information or error message
   */
  private async startServer(args: StartServer): Promise<unknown> {
    const error = this.validate(args, ['language_id']);
    if (error) {
      return error;
    }
    return await this.client.startServer(args.language_id, args.project);
  }

  /**
   * Stops a running language server gracefully
   * 
   * Terminates language server process and cleans up resources,
   * ensuring proper shutdown sequence and resource cleanup.
   * 
   * @private
   * @param {StopServer} args - Language server identification
   * @returns {Promise<string>} Success message or error message
   */
  private async stopServer(args: StopServer): Promise<unknown> {
    const error = this.validate(args, ['language_id']);
    if (error) {
      return error;
    }
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
   * Validates required arguments for tool handler methods using Zod schemas
   * 
   * Performs runtime validation of tool arguments against required field specifications,
   * ensuring type safety and proper error handling for missing parameters.
   * 
   * @private
   * @param {unknown} args - Tool arguments object to validate
   * @param {string[]} fields - Array of required field names for validation
   * @returns {string | null} Error message if validation fails, null if all requirements met
   */
  private validate(args: unknown, fields: string[]): string | null {
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
   * Connects the MCP server to stdio transport with error handling
   * 
   * Establishes MCP communication channel using standard input/output streams,
   * configures error handling, and starts message processing.
   * 
   * @param {StdioServerTransport} transport - Stdio transport for MCP communication
   * @returns {Promise<void>} Promise that resolves when connection is established and listening
   */
  async connect(transport: StdioServerTransport): Promise<void> {
    transport.onerror = () => { };
    await this.server.connect(transport);
  }
}
