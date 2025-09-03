/**
 * MCP Tool Definitions
 * 
 * @module server/tool
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Tool Definitions
 * 
 * Provides tool definitions for LSP operations exposed through the MCP protocol
 * 
 * @class McpTool
 */
export class McpTool {
  private limit: number;

  /**
   * Creates a new McpTool instance
   * 
   * @param {number} limit - Pagination limit for tool results
   */
  constructor(limit: number) {
    this.limit = limit;
  }

  /**
   * Tool definition for getting call hierarchy
   * 
   * @returns {Tool} Get call hierarchy tool
   */
  getCallHierarchy(): Tool {
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
   * @returns {Tool} Code actions tool
   */
  getCodeActions(): Tool {
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
   * @returns {Tool} Code action resolve tool
   */
  getCodeResolves(): Tool {
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
   * @returns {Tool} Document colors tool
   */
  getColors(): Tool {
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
   * @returns {Tool} Code completions tool
   */
  getCompletions(): Tool {
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
   * @returns {Tool} Folding ranges tool
   */
  getFoldingRanges(): Tool {
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
   * @returns {Tool} Format tool
   */
  getFormat(): Tool {
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
   * @returns {Tool} Highlights tool
   */
  getHighlights(): Tool {
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
   * @returns {Tool} Hover information tool
   */
  getHover(): Tool {
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
   * @returns {Tool} Implementations tool
   */
  getImplementations(): Tool {
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
   * @returns {Tool} Get incoming calls tool
   */
  getIncomingCalls(): Tool {
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
   * Tool definition for getting inlay hint details
   * 
   * @returns {Tool} Inlay hint details tool
   */
  getInlayHint(): Tool {
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
   * Tool definition for getting inlay hints
   * 
   * @returns {Tool} Inlay hints tool
   */
  getInlayHints(): Tool {
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
   * Tool definition for getting linked editing range
   * 
   * @returns {Tool} Linked editing range tool
   */
  getLinkedEditingRange(): Tool {
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
   * @returns {Tool} Document link resolve tool
   */
  getLinkResolves(): Tool {
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
   * @returns {Tool} Document links tool
   */
  getLinks(): Tool {
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
   * @returns {Tool} Get outgoing calls tool
   */
  getOutgoingCalls(): Tool {
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
   * Tool definition for project files listing
   * 
   * @returns {Tool} Project files tool
   */
  getProjectFiles(): Tool {
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
   * @returns {Tool} Project symbols tool
   */
  getProjectSymbols(): Tool {
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
   * @returns {Tool} Range format tool
   */
  getRangeFormat(): Tool {
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
   * @returns {Tool} Completion resolve tool
   */
  getResolves(): Tool {
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
   * @returns {Tool} Selection range tool
   */
  getSelectionRange(): Tool {
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
   * @returns {Tool} Semantic tokens tool
   */
  getSemanticTokens(): Tool {
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
   * @returns {Tool} Server capabilities tool
   */
  getServerCapabilities(): Tool {
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
   * @returns {Tool} Server projects tool
   */
  getServerProjects(): Tool {
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
   * @returns {Tool} Server status tool
   */
  getServerStatus(): Tool {
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
   * @returns {Tool} Signature help tool
   */
  getSignature(): Tool {
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
   * @returns {Tool} Get subtypes tool
   */
  getSubtypes(): Tool {
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
   * @returns {Tool} Get supertypes tool
   */
  getSupertypes(): Tool {
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
   * @returns {Tool} Symbol definitions tool
   */
  getSymbolDefinitions(): Tool {
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
   * @returns {Tool} Symbol references tool
   */
  getSymbolReferences(): Tool {
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
   * @returns {Tool} Symbol renames tool
   */
  getSymbolRenames(): Tool {
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
   * @returns {Tool} Document symbols tool
   */
  getSymbols(): Tool {
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
   * Tool definition for getting type definitions
   * 
   * @returns {Tool} Type definitions tool
   */
  getTypeDefinitions(): Tool {
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
   * @returns {Tool} Get type hierarchy tool
   */
  getTypeHierarchy(): Tool {
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
   * Returns all available MCP tools
   * 
   * @returns {Tool[]} Array of MCP tool definitions
   */
  getTools(): Tool[] {
    return [
      this.getCallHierarchy(),
      this.getCodeActions(),
      this.getCodeResolves(),
      this.getColors(),
      this.getCompletions(),
      this.getFoldingRanges(),
      this.getFormat(),
      this.getHighlights(),
      this.getHover(),
      this.getImplementations(),
      this.getIncomingCalls(),
      this.getInlayHint(),
      this.getInlayHints(),
      this.getLinkedEditingRange(),
      this.getLinkResolves(),
      this.getLinks(),
      this.getOutgoingCalls(),
      this.getProjectFiles(),
      this.getProjectSymbols(),
      this.getRangeFormat(),
      this.getResolves(),
      this.getSelectionRange(),
      this.getSemanticTokens(),
      this.getServerCapabilities(),
      this.getServerProjects(),
      this.getServerStatus(),
      this.getSignature(),
      this.getSubtypes(),
      this.getSupertypes(),
      this.getSymbolDefinitions(),
      this.getSymbolReferences(),
      this.getSymbolRenames(),
      this.getSymbols(),
      this.getTypeDefinitions(),
      this.getTypeHierarchy(),
      this.loadProjectFiles(),
      this.restartServer(),
      this.startServer(),
      this.stopServer()
    ];
  }

  /**
   * Tool definition for loading project files
   * 
   * @returns {Tool} Load project files tool
   */
  loadProjectFiles(): Tool {
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
   * @returns {Tool} Restart server tool
   */
  restartServer(): Tool {
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
   * Tool definition for starting language servers
   * 
   * @returns {Tool} Start server tool
   */
  startServer(): Tool {
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
   * @returns {Tool} Stop server tool
   */
  stopServer(): Tool {
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
}
