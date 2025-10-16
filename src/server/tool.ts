/**
 * MCP Tool Definitions
 * 
 * @module server/tool
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Tool Definitions for Language Server Protocol Integration
 * 
 * Provides comprehensive MCP tool definitions that bridge LSP server capabilities
 * with Model Context Protocol, enabling Claude agents to interact with language servers.
 * 
 * @class McpTool
 */
export class McpTool {
  private limit: number;
  private query: string;

  /**
   * Creates a new McpTool instance with pagination configuration
   * 
   * Initializes tool definitions with consistent pagination limits
   * for all tools that support result pagination.
   * 
   * @param {number} limit - Default pagination limit for paginated tool results
   * @param {string} query - Default query
   */
  constructor(limit: number, query: string) {
    this.limit = limit;
    this.query = query;
  }

  /**
   * Creates MCP tool for call hierarchy preparation
   * 
   * Enables exploration of caller and callee relationships for functions and methods,
   * supporting code navigation and dependency analysis.
   * 
   * @returns {Tool} MCP tool definition for call hierarchy analysis
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
   * Creates MCP tool for code actions and quick fixes
   * 
   * Provides access to automated refactoring suggestions, error corrections,
   * and code improvement recommendations from language servers.
   * 
   * @returns {Tool} MCP tool definition for code action discovery
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
   * Creates MCP tool for resolving code action details
   * 
   * Enables fetching complete information for code actions including
   * workspace edits, commands, and additional context.
   * 
   * @returns {Tool} MCP tool definition for code action resolution
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
   * Creates MCP tool for document color extraction
   * 
   * Identifies color values (hex, rgb, hsl) within documents for
   * color picker integration and visual color management.
   * 
   * @returns {Tool} MCP tool definition for color detection
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
   * Creates MCP tool for code completions and IntelliSense
   * 
   * Provides context-aware auto-completion suggestions including symbols,
   * keywords, snippets, and documentation for enhanced coding productivity.
   * 
   * @returns {Tool} MCP tool definition for completion suggestions
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
   * Creates MCP tool for code folding range identification
   * 
   * Analyzes document structure to find collapsible code sections like
   * functions, classes, blocks, and comments for improved editor navigation.
   * 
   * @returns {Tool} MCP tool definition for folding range analysis
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
   * Creates MCP tool for document formatting
   * 
   * Applies consistent code formatting using language server style rules
   * including indentation, spacing, and language-specific conventions.
   * 
   * @returns {Tool} MCP tool definition for document formatting
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
   * Creates MCP tool for symbol highlighting
   * 
   * Highlights all occurrences of the symbol under cursor for visual
   * identification and quick navigation to related code locations.
   * 
   * @returns {Tool} MCP tool definition for symbol highlighting
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
   * Creates MCP tool for hover information and documentation
   * 
   * Provides type information, documentation, and contextual details
   * for symbols, functions, and variables at cursor position.
   * 
   * @returns {Tool} MCP tool definition for hover information
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
   * Creates MCP tool for implementation discovery
   * 
   * Locates concrete implementations of interfaces, abstract methods,
   * and virtual functions for navigation and analysis.
   * 
   * @returns {Tool} MCP tool definition for implementation search
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
   * Creates MCP tool for call hierarchy incoming calls analysis
   * 
   * Discovers all functions that call the specified symbol,
   * enabling reverse dependency analysis and call graph exploration.
   * 
   * @returns {Tool} MCP tool definition for incoming call analysis
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
   * Creates MCP tool for resolving inlay hint details
   * 
   * Fetches complete information for inlay hints including tooltips,
   * click actions, and extended documentation context.
   * 
   * @returns {Tool} MCP tool definition for inlay hint resolution
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
   * Creates MCP tool for inline type annotations and parameter hints
   * 
   * Provides visual type hints, parameter names, and return types
   * within code ranges for improved readability and understanding.
   * 
   * @returns {Tool} MCP tool definition for inlay hint analysis
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
   * Creates MCP tool for linked editing range discovery
   * 
   * Identifies ranges that should be edited simultaneously, such as
   * HTML tag pairs or variable declarations that need synchronized updates.
   * 
   * @returns {Tool} MCP tool definition for linked editing analysis
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
   * Creates MCP tool for resolving document link targets
   * 
   * Fetches actual target URLs for clickable links within documents,
   * enabling navigation to external resources and file references.
   * 
   * @returns {Tool} MCP tool definition for document link resolution
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
   * Creates MCP tool for document link extraction
   * 
   * Scans documents for URLs, file references, and other clickable links
   * that can be navigated or opened in external applications.
   * 
   * @returns {Tool} MCP tool definition for link discovery
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
   * Creates MCP tool for call hierarchy outgoing calls analysis
   * 
   * Discovers all functions called by the specified symbol,
   * enabling dependency analysis and call graph exploration.
   * 
   * @returns {Tool} MCP tool definition for outgoing call analysis
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
   * Creates MCP tool for project file listing with pagination
   * 
   * Lists all files in project workspace with pagination support
   * for efficient browsing of large codebases.
   * 
   * @returns {Tool} MCP tool definition for project file enumeration
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
   * Creates MCP tool for project-wide symbol search with pagination
   * 
   * Enables comprehensive symbol discovery across entire workspace
   * with query-based filtering and pagination for large result sets.
   * 
   * @returns {Tool} MCP tool definition for workspace symbol search
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
          query: { type: 'string', description: 'Symbol search query', default: this.query },
          limit: { type: 'number', description: 'Pagination limit for number of symbols to return', default: this.limit },
          offset: { type: 'number', description: 'Pagination offset for number of symbols to skip', default: 0 },
          timeout: { type: 'number', description: 'Optional load timeout in milliseconds' }
        },
        required: ['language_id', 'project']
      }
    };
  }

  /**
   * Creates MCP tool for range-specific code formatting
   * 
   * Applies formatting to selected text ranges while preserving
   * surrounding code structure and maintaining style consistency.
   * 
   * @returns {Tool} MCP tool definition for range formatting
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
   * Creates MCP tool for resolving completion item details
   * 
   * Fetches extended information for completion items including
   * documentation, additional text edits, and detailed type information.
   * 
   * @returns {Tool} MCP tool definition for completion resolution
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
   * Creates MCP tool for intelligent selection expansion
   * 
   * Expands text selection to logical code boundaries like expressions,
   * statements, blocks, and functions for efficient code selection.
   * 
   * @returns {Tool} MCP tool definition for selection range expansion
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
   * Creates MCP tool for semantic token analysis
   * 
   * Extracts detailed syntax tokens for enhanced syntax highlighting,
   * including token types, modifiers, and semantic classifications.
   * 
   * @returns {Tool} MCP tool definition for semantic token extraction
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
   * Creates MCP tool for language server capability inspection
   * 
   * Retrieves comprehensive LSP server capabilities and maps them
   * to available MCP tools for dynamic tool discovery and debugging.
   * 
   * @returns {Tool} MCP tool definition for server capability analysis
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
   * Creates MCP tool for server project enumeration
   * 
   * Lists all configured projects for a language server including
   * paths, extensions, and configuration details.
   * 
   * @returns {Tool} MCP tool definition for project listing
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
   * Creates MCP tool for language server status monitoring
   * 
   * Provides detailed runtime status including process state, uptime,
   * project associations, and error conditions for all language servers.
   * 
   * @returns {Tool} MCP tool definition for server status monitoring
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
   * Creates MCP tool for function signature help
   * 
   * Provides function signature information, parameter details, and overload
   * documentation to assist with function calls and method invocations.
   * 
   * @returns {Tool} MCP tool definition for signature help
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
   * Creates MCP tool for type hierarchy subtype discovery
   * 
   * Finds all derived classes and implementing types that inherit
   * from the specified type for inheritance analysis.
   * 
   * @returns {Tool} MCP tool definition for subtype discovery
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
   * Creates MCP tool for type hierarchy supertype discovery
   * 
   * Finds all base classes and implemented interfaces that the
   * specified type inherits from for inheritance analysis.
   * 
   * @returns {Tool} MCP tool definition for supertype discovery
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
   * Creates MCP tool for symbol definition navigation
   * 
   * Locates primary definitions of symbols, functions, classes, or variables
   * for precise navigation to declaration sites in code.
   * 
   * @returns {Tool} MCP tool definition for definition lookup
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
      },
      _meta: {
        usage: [
          'Place cursor on symbol usage or reference, not definition',
          'Returns empty array when cursor is on the symbol definition itself',
          'Works with function calls, variable references, and import statements'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for symbol reference search
   * 
   * Finds all usage locations of symbols throughout the workspace
   * with optional inclusion of symbol declarations.
   * 
   * @returns {Tool} MCP tool definition for reference search
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
      },
      _meta: {
        usage: [
          'Place cursor on symbol name',
          'Sensitive to cursor position, be precise with character placement',
          'Returns all locations where the symbol is used throughout the project',
          'Works with simple symbol references, not complex expressions'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for symbol rename preview
   * 
   * Generates preview of all code locations that would be affected
   * by symbol rename operations for review before execution.
   * 
   * @returns {Tool} MCP tool definition for rename preview
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
   * Creates MCP tool for document symbol listing with pagination
   * 
   * Extracts document outline including functions, classes, variables,
   * and other symbols with hierarchical structure and pagination.
   * 
   * @returns {Tool} MCP tool definition for document symbol enumeration
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
   * Aggregates all available MCP tools into comprehensive registry
   * 
   * Returns complete collection of LSP-to-MCP tool definitions including
   * language features, server management, and workspace operations.
   * 
   * @returns {Tool[]} Complete array of all available MCP tool definitions
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
      this.restartServer(),
      this.startServer(),
      this.stopServer()
    ];
  }

  /**
   * Creates MCP tool for type definition navigation
   * 
   * Navigates to type definitions rather than symbol definitions,
   * useful for understanding data types and class hierarchies.
   * 
   * @returns {Tool} MCP tool definition for type definition lookup
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
   * Creates MCP tool for type hierarchy analysis
   * 
   * Builds type hierarchy structure showing inheritance relationships
   * for object-oriented programming navigation and analysis.
   * 
   * @returns {Tool} MCP tool definition for type hierarchy preparation
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
   * Creates MCP tool for language server restart operations
   * 
   * Enables restarting language servers with new project configurations
   * for error recovery and configuration changes.
   * 
   * @returns {Tool} MCP tool definition for server restart
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
   * Creates MCP tool for language server startup operations
   * 
   * Initializes new language server instances with project selection,
   * enabling LSP features for target codebases and development workflows.
   * 
   * @returns {Tool} MCP tool definition for server startup
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
   * Creates MCP tool for language server shutdown operations
   * 
   * Gracefully terminates language server processes with proper cleanup,
   * ensuring resource management and process lifecycle control.
   * 
   * @returns {Tool} MCP tool definition for server shutdown
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
