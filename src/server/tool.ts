/**
 * MCP Tools Implementation
 * 
 * @module server/tools
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
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

interface StartServerArgs extends LanguageIdArgs {
  project?: string;
}

interface StopServerArgs extends LanguageIdArgs { }

interface SupportedTools {
  supported: boolean;
  tools: Tool[];
}

interface ToolCapabilities {
  capability: string;
  tool: Tool;
}

/**
 * MCP Tool Implementation
 * 
 * Handles all LSP tool operations and server management functionality
 * for the MCP server.
 * 
 * @class Tool
 */
export class McpTool {
  private client: Client;
  private config: Config;
  private paginationLimit: number;

  /**
   * Creates a new McpTool instance
   * 
   * @param {Client} client - LSP client manager instance
   * @param {Config} config - Configuration parser instance
   * @param {number} paginationLimit - Pagination limit for tool results
   */
  constructor(client: Client, config: Config, paginationLimit: number) {
    this.client = client;
    this.config = config;
    this.paginationLimit = paginationLimit;
  }

  /**
   * Generates capability to tool mapping based on server capabilities
   * 
   * @param {ServerCapabilities} capabilities - Server capabilities object
   * @param {ToolCapabilities[]} toolCapabilities - Tool to capability mappings from McpServer
   * @returns {Record<string, SupportedTools>} Mapping of capabilities to tool definitions
   */
  generateCapabilityToolMap(capabilities: ServerCapabilities, toolCapabilities: ToolCapabilities[]): Record<string, SupportedTools> {
    const server = new Map<string, Tool[]>();
    const toolMap: Record<string, SupportedTools> = {};
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
          toolMap[capability] = { supported: true, tools };
        } else {
          toolMap[capability] = { supported: false, tools: [] };
        }
      }
    }
    const serverOperations = server.get('serverOperations');
    if (serverOperations && serverOperations.length) {
      toolMap['serverOperations'] = { supported: true, tools: serverOperations };
    }
    return toolMap;
  }

  /**
   * Get call hierarchy tool requests
   * 
   * @param {GetCallHierarchyArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getCallHierarchy(args: GetCallHierarchyArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'character', 'line']);
    if (error) return error;
    const params: CallHierarchyPrepareParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, CallHierarchyPrepareRequest.method, params);
  }

  /**
   * Get code actions tool requests
   * 
   * @param {GetCodeActionsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getCodeActions(args: GetCodeActionsArgs): Promise<any> {
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
   * Get code resolves tool requests
   * 
   * @param {GetCodeResolvesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getCodeResolves(args: GetCodeResolvesArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'item']);
    if (error) return error;
    return await this.client.sendServerRequest(args.file_path, CodeActionResolveRequest.method, args.item);
  }

  /**
   * Get colors tool requests
   * 
   * @param {GetColorsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getColors(args: GetColorsArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path']);
    if (error) return error;
    const params = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DocumentColorRequest.method, params);
  }

  /**
   * Get completions tool requests
   * 
   * @param {GetCompletionsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getCompletions(args: GetCompletionsArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'character', 'line']);
    if (error) return error;
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, CompletionRequest.method, params);
  }

  /**
   * Get folding ranges tool requests
   * 
   * @param {GetFoldingRangesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getFoldingRanges(args: GetFoldingRangesArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path']);
    if (error) return error;
    const params = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, FoldingRangeRequest.method, params);
  }

  /**
   * Get format tool requests
   * 
   * @param {GetFormatArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getFormat(args: GetFormatArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path']);
    if (error) return error;
    const params = {
      options: { tabSize: 2, insertSpaces: true },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DocumentFormattingRequest.method, params);
  }

  /**
   * Get highlights tool requests
   * 
   * @param {GetHighlightsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getHighlights(args: GetHighlightsArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'character', 'line']);
    if (error) return error;
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DocumentHighlightRequest.method, params);
  }

  /**
   * Get hover tool requests
   * 
   * @param {GetHoverArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getHover(args: GetHoverArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'character', 'line']);
    if (error) return error;
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, HoverRequest.method, params);
  }

  /**
   * Get implementations tool requests
   * 
   * @param {GetImplementationsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getImplementations(args: GetImplementationsArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'character', 'line']);
    if (error) return error;
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, ImplementationRequest.method, params);
  }

  /**
   * Get incoming calls tool requests
   * 
   * @param {GetIncomingCallsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getIncomingCalls(args: GetIncomingCallsArgs): Promise<any> {
    const error = this.validateArgs(args, ['item']);
    if (error) return error;
    const params: CallHierarchyIncomingCallsParams = {
      item: args.item
    };
    const filePath = this.setFilePath(args.item);
    return await this.client.sendServerRequest(filePath, CallHierarchyIncomingCallsRequest.method, params);
  }

  /**
   * Get inlay hint tool requests
   * 
   * @param {GetInlayHintArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getInlayHint(args: GetInlayHintArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'item']);
    if (error) return error;
    return await this.client.sendServerRequest(args.file_path, InlayHintResolveRequest.method, args.item);
  }

  /**
   * Get inlay hints tool requests
   * 
   * @param {GetInlayHintsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getInlayHints(args: GetInlayHintsArgs): Promise<any> {
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
   * Get linked editing range tool requests
   * 
   * @param {GetLinkedEditingRangeArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getLinkedEditingRange(args: GetLinkedEditingRangeArgs): Promise<any> {
    const error = this.validateArgs(args, ['character', 'file_path', 'line']);
    if (error) return error;
    const params: LinkedEditingRangeParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, LinkedEditingRangeRequest.method, params);
  }

  /**
   * Get link resolves tool requests
   * 
   * @param {GetLinkResolvesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getLinkResolves(args: GetLinkResolvesArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'item']);
    if (error) return error;
    return await this.client.sendServerRequest(args.file_path, DocumentLinkResolveRequest.method, args.item);
  }

  /**
   * Get links tool requests
   * 
   * @param {GetLinksArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getLinks(args: GetLinksArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path']);
    if (error) return error;
    const params = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DocumentLinkRequest.method, params);
  }

  /**
   * Get outgoing calls tool requests
   * 
   * @param {GetOutgoingCallsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getOutgoingCalls(args: GetOutgoingCallsArgs): Promise<any> {
    const error = this.validateArgs(args, ['item']);
    if (error) return error;
    const params: CallHierarchyOutgoingCallsParams = {
      item: args.item
    };
    const filePath = this.setFilePath(args.item);
    return await this.client.sendServerRequest(filePath, CallHierarchyOutgoingCallsRequest.method, params);
  }

  /**
   * Get project files tool requests
   * 
   * @param {GetProjectFilesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getProjectFiles(args: GetProjectFilesArgs): Promise<any> {
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
    const limit = args.limit ?? this.paginationLimit;
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
   * Get project symbol search tool requests
   * 
   * @param {GetProjectSymbolsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getProjectSymbols(args: GetProjectSymbolsArgs): Promise<any> {
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
    const limit = args.limit ?? this.paginationLimit;
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
   * Get range format tool requests
   * 
   * @param {GetRangeFormatArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getRangeFormat(args: GetRangeFormatArgs): Promise<any> {
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
   * Get resolves tool requests
   * 
   * @param {GetResolvesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getResolves(args: GetResolvesArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path', 'item']);
    if (error) return error;
    const params = {
      ...args.item,
      uri: `file://${args.file_path}`
    };
    return await this.client.sendServerRequest(args.file_path, CompletionResolveRequest.method, params);
  }

  /**
   * Get selection range tool requests
   * 
   * @param {GetSelectionRangeArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getSelectionRange(args: GetSelectionRangeArgs): Promise<any> {
    const error = this.validateArgs(args, ['character', 'file_path', 'line']);
    if (error) return error;
    const params: SelectionRangeParams = {
      positions: [{ character: args.character, line: args.line }],
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, SelectionRangeRequest.method, params);
  }

  /**
   * Get semantic tokens tool requests
   * 
   * @param {GetSemanticTokensArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getSemanticTokens(args: GetSemanticTokensArgs): Promise<any> {
    const error = this.validateArgs(args, ['file_path']);
    if (error) return error;
    const params: SemanticTokensParams = {
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, SemanticTokensRequest.method, params);
  }

  /**
   * Get server capabilities tool requests
   * 
   * @param {GetServerCapabilitiesArgs} args - Tool arguments
   * @param {ToolCapabilities[]} [toolCapabilities] - Optional tool capabilities from McpServer
   * @returns {Promise<any>} Tool execution response
   */
  async getServerCapabilities(args: GetServerCapabilitiesArgs, toolCapabilities?: ToolCapabilities[]): Promise<any> {
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
    const tools = toolCapabilities ? this.generateCapabilityToolMap(capabilities, toolCapabilities) : {};
    return { language_id: args.language_id, project, capabilities, tools };
  }

  /**
   * Get server projects tool requests
   * 
   * @param {GetServerProjectsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getServerProjects(args: GetServerProjectsArgs): Promise<any> {
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
   * Get server status tool requests
   * 
   * @param {GetServerStatusArgs} args - Tool arguments
   * @returns {Promise<ServerStatus | Record<string, ServerStatus>>} Tool execution response
   */
  async getServerStatus(args: GetServerStatusArgs): Promise<ServerStatus | Record<string, ServerStatus>> {
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
   * Get signature tool requests
   * 
   * @param {GetSignatureArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getSignature(args: GetSignatureArgs): Promise<any> {
    const error = this.validateArgs(args, ['character', 'file_path', 'line']);
    if (error) return error;
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, SignatureHelpRequest.method, params);
  }

  /**
   * Get subtypes tool requests
   * 
   * @param {GetSubtypesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getSubtypes(args: GetSubtypesArgs): Promise<any> {
    const error = this.validateArgs(args, ['item']);
    if (error) return error;
    const params: TypeHierarchySubtypesParams = {
      item: args.item
    };
    const filePath = this.setFilePath(args.item);
    return await this.client.sendServerRequest(filePath, TypeHierarchySubtypesRequest.method, params);
  }

  /**
   * Get supertypes tool requests
   * 
   * @param {GetSupertypesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getSupertypes(args: GetSupertypesArgs): Promise<any> {
    const error = this.validateArgs(args, ['item']);
    if (error) return error;
    const params: TypeHierarchySupertypesParams = {
      item: args.item
    };
    const filePath = this.setFilePath(args.item);
    return await this.client.sendServerRequest(filePath, TypeHierarchySupertypesRequest.method, params);
  }

  /**
   * Get symbol definitions tool requests
   * 
   * @param {GetSymbolDefinitionsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getSymbolDefinitions(args: GetSymbolDefinitionsArgs): Promise<any> {
    const error = this.validateArgs(args, ['character', 'file_path', 'line']);
    if (error) return error;
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, DefinitionRequest.method, params);
  }

  /**
   * Get symbol references tool requests
   * 
   * @param {GetSymbolReferencesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getSymbolReferences(args: GetSymbolReferencesArgs): Promise<any> {
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
   * Get symbol renames tool requests
   * 
   * @param {GetSymbolRenamesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getSymbolRenames(args: GetSymbolRenamesArgs): Promise<any> {
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
   * Get symbols tool requests
   * 
   * @param {GetSymbolsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getSymbols(args: GetSymbolsArgs): Promise<any> {
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
    const limit = args.limit ?? this.paginationLimit;
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
   * Get type definitions tool requests
   * 
   * @param {GetTypeDefinitionsArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getTypeDefinitions(args: GetTypeDefinitionsArgs): Promise<any> {
    const error = this.validateArgs(args, ['character', 'file_path', 'line']);
    if (error) return error;
    const params: TextDocumentPositionParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, TypeDefinitionRequest.method, params);
  }

  /**
   * Get type hierarchy tool requests
   * 
   * @param {GetTypeHierarchyArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async getTypeHierarchy(args: GetTypeHierarchyArgs): Promise<any> {
    const error = this.validateArgs(args, ['character', 'file_path', 'line']);
    if (error) return error;
    const params: TypeHierarchyPrepareParams = {
      position: { character: args.character, line: args.line },
      textDocument: { uri: `file://${args.file_path}` }
    };
    return await this.client.sendServerRequest(args.file_path, TypeHierarchyPrepareRequest.method, params);
  }

  /**
   * Load project files tool requests
   * 
   * @param {LoadProjectFilesArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async loadProjectFiles(args: LoadProjectFilesArgs): Promise<any> {
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
   * Restart server tool requests
   * 
   * @param {RestartServerArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async restartServer(args: RestartServerArgs): Promise<any> {
    const error = this.validateArgs(args, ['language_id', 'project']);
    if (error) return error;
    return await this.client.restartServer(args.language_id, args.project);
  }

  /**
   * Start server tool requests
   * 
   * @param {StartServerArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async startServer(args: StartServerArgs): Promise<any> {
    const error = this.validateArgs(args, ['language_id']);
    if (error) return error;
    return await this.client.startServer(args.language_id, args.project);
  }

  /**
   * Stop server tool requests
   * 
   * @param {StopServerArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  async stopServer(args: StopServerArgs): Promise<any> {
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
}
