# Language Server Protocol MCP Server

[![License: BSD 3-Clause](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg?style=flat&logo=opensourceinitiative&logoColor=white)](https://github.com/axivo/mcp-lsp/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/@axivo/mcp-lsp.svg?style=flat&logo=npm&logoColor=white)](https://www.npmjs.com/package/@axivo/mcp-lsp)
[![Node.js](https://img.shields.io/badge/Node.js->=24.0.0-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript->=5.0.0-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![LSP](https://img.shields.io/badge/LSP->=3.17.0-FF6B6B?style=flat&logo=microsoft&logoColor=white)](https://microsoft.github.io/language-server-protocol/)

A comprehensive MCP (Model Context Protocol) server that bridges Language Server Protocol (LSP) capabilities with Claude, enabling intelligent code analysis, navigation, and development assistance across multiple programming languages.

## Features

### Core Capabilities

- **Multi-Language Support**: Go, Helm, Kotlin, Python, Terraform, TypeScript, and [more](https://microsoft.github.io/language-server-protocol/implementors/servers/)
- **Intelligent Code Analysis**: Symbol definitions, references, implementations, and type hierarchies
- **Advanced Navigation**: Call hierarchies, document symbols, and workspace-wide symbol search
- **Code Intelligence**: Hover information, completions, signature help, and inlay hints
- **Formatting & Refactoring**: Document formatting, range formatting, and code action suggestions
- **Project Management**: Multi-project workspace support with comprehensive file indexing

### Security & Performance

- **Process Isolation**: Each language server runs in isolated processes with proper lifecycle management
- **Rate Limiting**: Configurable request throttling (default: 100 requests/minute)
- **Resource Management**: Concurrent file read limits and graceful shutdown handling
- **Error Recovery**: Robust error handling with automatic server restart capabilities

## Language Server Setup

### Prerequisites

The MCP server foundation is built on battle-tested `vscode-jsonrpc` and `vscode-languageserver-protocol` libraries, providing compatibility with all VSCode [language servers](https://microsoft.github.io/language-server-protocol/implementors/servers/). Example installation for [`Kotlin`](https://github.com/Kotlin/kotlin-lsp) language server:

```bash
brew install JetBrains/utils/kotlin-lsp
```

### Configuration File

Create an MCP server configuration file, defining your language servers and projects.

> [!NOTE]
> A [`lsp.json`](.claude/lsp.json) configuration sample with popular development languages and multiple projects is provided as a starter guide.

A language server configuration has the following format:

```json
{
  "servers": {
    "language-id": {                                # Required unique language identifier
      "command": "language-server-binary",          # Required language server binary
      "args": [                                     # Optional language server arguments
        "--stdio"
      ],
      "configuration": {},                          # Optional language server configuration
      "env": {},                                    # Optional environment variables
      "extensions": [                               # Required language server extensions
        ".extension"
      ],
      "init": [],                                   # Optional language server initialization commands
      "projects": [                                 # Required language server list of projects
        {
          "name": "project-name",                   # Required unique project name
          "description": "A description",           # Optional description
          "url": "https://github.com/org/project",  # Optional project URL
          "path": "/Users/username/github/project"  # Required project local path
          "patterns": {                             # Optional exclude or include patterns
            "exclude": [
              "**/directory",
              "**/file.extension"
            ],
            "include": [
              "**/directory",
              "**/file.extension"
            ],
          }
        }
      ],
      "settings": {                                 # Optional language server settings
        "maxConcurrentFileReads": 10,
        "messageRequest": true,
        "preloadFiles": true,
        "rateLimitMaxRequests": 100,
        "rateLimitWindowMs": 60000,
        "registrationRequest": true,
        "shutdownGracePeriodMs": 100,
        "timeoutMs": 600000,
        "workspace": true
      }
    }
  }
}
```

#### Optional Language Server Configuration

Language servers often require a specific configuration to function optimally. Configuration requirements are documented in each server's [official repository](https://microsoft.github.io/language-server-protocol/implementors/servers/). 

For example, `pyright-langserver` requires the following settings:

```json
"configuration": {
  "settings": {
    "python": {
      "analysis": {
        "autoSearchPaths": true,
        "diagnosticMode": "workspace"
      }
    }
  }
}
```

#### Optional Language Server Settings

These settings control LSP protocol behavior and server compatibility:

- `maxConcurrentFileReads` - maximum number of files to read concurrently when opening project files, controls memory usage and performance during project initialization (default: `10`)
- `messageRequest` - controls whether the language server can send `window/showMessage` requests to display user dialogs, disable for headless operation or automated environments (default: `true`)
- `preloadFiles` - controls whether project files are loaded during or after project initialization (default: `true`)
- `rateLimitMaxRequests` - maximum number of requests allowed per rate limit window, prevents overwhelming the language server with too many concurrent requests (default: `100`)
- `rateLimitWindowMs` - time window in milliseconds for rate limiting, requests are counted within this sliding window (default: `60000` - 1 minute)
- `registrationRequest` - controls whether the language server can send `client/registerCapability` requests to dynamically register capabilities, disable for servers that ignore client capability declarations (default: `true`)
- `shutdownGracePeriodMs` - time in milliseconds to wait after sending shutdown request before forcing process termination, allows language server to complete cleanup operations (default: `100`)
- `timeoutMs` - maximum time in milliseconds to wait for language server initialization, prevents hanging on unresponsive servers (default: `600000` - 10 minutes)
- `workspace` - controls whether the language server initialization sends `workspace/symbol` requests to test workspace capabilities, disable for servers that don't support workspace operations or cause initialization failures (default: `true`)

#### Optional Language Server Project File Patterns

File patterns use [`fast-glob`](https://www.npmjs.com/package/fast-glob) syntax. By default, the `.` dot prefix, `__` double underscore prefix, `bin`, `build`, `cache`, `coverage`, `dist`, `docs`, `excludes`, `log`, `node_modules`, `obj`, `out`, `target`, `temp`, `tests`, `tmp`, `vendor` and `venv` directories are excluded. Use `include` or `exclude` patterns to manage specific directories or files (e.g., `**/dist`, `**/dist/**/*.d.ts`, `**/*.test.js`).

## MCP Server Configuration

Add to your `mcp.json` MCP servers configuration:

```json
{
  "mcpServers": {
    "language-server": {
      "command": "npx",
      "args": [
        "-y",
        "@axivo/mcp-lsp"
      ],
      "env": {
        "LSP_FILE_PATH": "/Users/username/github/mcp-lsp/.claude/lsp.json"
      }
    }
  }
}
```

### Environment Variables

- `LSP_FILE_PATH` - Absolute path to your LSP server configuration JSON file

## Multiple Language Servers Usage

Run multiple language servers simultaneously to analyze different projects:

```
✅ ansible (k3s-cluster) + typescript (k3s-cluster-actions)
✅ go (helm) + kotlin (ktor) + python (fastapi)
```

A language server can run only **one project at a time**:

```
❌ typescript (mcp-lsp) + typescript (typescript-sdk)
```

To switch projects, restart the language server with the desired project name.

## Getting Started

Ask Claude to explain how the LSP tools work:

- *Start the TypeScript language server with `typescript-sdk` project and check the server capabilities.*
- *Please explain how LSP tools help you understand and review source code.*

To start performing a code review, ask Claude to:

- *Start the TypeScript language server with `typescript-sdk` project and check the server capabilities.*
- *Read the `/Users/username/github/mcp-lsp/.claude/templates/code-review.md` template prior code review.*
- *Perform a detailed review of project source code using the LSP tools and let me know your findings.*

> [!NOTE]
> Language server start time varies by language and project size, typically few seconds for a project with thousands of files. Some language servers like `Kotlin` may take several minutes to initialize large projects. Increase `timeoutMs` value accordingly, if default timeout is reached.

### Claude's Review

A [public session](https://claude.ai/share/d6a5809d-0703-4f16-9c2b-a4e8d639f227) using the [DEVELOPER](https://github.com/axivo/claude) profile demonstrates LSP tool capabilities and explains how semantic analysis provides compiler-accurate understanding compared to traditional text-based search methods.

### Workflow Templates

See the available [templates](.claude/templates) Claude can use for systematic development workflows.

## MCP Tools

### Server Management Tools

1. **`start_server`**
   - Start language server with project selection
   - Inputs: `language_id`, `project` (optional)
   - Returns: Server startup confirmation with process information

2. **`stop_server`**
   - Stop running language server gracefully
   - Inputs: `language_id`
   - Returns: Shutdown confirmation with cleanup details

3. **`restart_server`**
   - Restart language server with optional project selection
   - Inputs: `language_id`, `project`
   - Returns: Restart confirmation with new process information

4. **`get_server_status`**
   - Check running status of language servers
   - Inputs: `language_id` (optional)
   - Returns: Detailed status including uptime, project associations, and health

5. **`get_server_capabilities`**
   - Get language server capabilities and tool mappings
   - Inputs: `language_id`
   - Returns: Comprehensive capability list with available MCP tool mappings

6. **`get_server_projects`**
   - List available projects for a language server
   - Inputs: `language_id`
   - Returns: Array of configured projects with paths and descriptions

### Project & Workspace Tools

7. **`get_project_files`**
   - List all files in the project workspace with pagination
   - Inputs: `language_id`, `project`, `limit` (optional), `offset` (optional)
   - Returns: Paginated list of project files with paths

8. **`get_project_symbols`**
   - Search for symbols across entire project workspace with pagination
   - Inputs: `language_id`, `project`, `query`, `limit` (optional), `offset` (optional), `timeout` (optional)
   - Returns: Paginated workspace symbol search results

### Code Analysis Tools

9. **`get_hover`**
    - Show type information and documentation at cursor position
    - Inputs: `file_path`, `line`, `character`
    - Returns: Type information, documentation, and contextual details

10. **`get_symbol_definitions`**
    - Navigate to where symbol is originally defined
    - Inputs: `file_path`, `line`, `character`
    - Returns: Array of definition locations with file paths and positions

11. **`get_symbol_references`**
    - Find all locations where symbol is used or referenced
    - Inputs: `file_path`, `line`, `character`, `include_declaration` (optional)
    - Returns: Array of reference locations throughout workspace

12. **`get_implementations`**
    - Find all locations where interface or abstract method is implemented
    - Inputs: `file_path`, `line`, `character`
    - Returns: Array of concrete implementation locations

13. **`get_type_definitions`**
    - Navigate to where symbol type is defined
    - Inputs: `file_path`, `line`, `character`
    - Returns: Array of type definition locations

### Navigation Tools

14. **`get_call_hierarchy`**
    - Build call hierarchy showing caller and callee relationships
    - Inputs: `file_path`, `line`, `character`
    - Returns: Call hierarchy preparation data

15. **`get_incoming_calls`**
    - Show all functions that call this symbol
    - Inputs: `item` (from get_call_hierarchy)
    - Returns: Array of incoming call relationships

16. **`get_outgoing_calls`**
    - Show all functions that this symbol calls
    - Inputs: `item` (from get_call_hierarchy)
    - Returns: Array of outgoing call relationships

17. **`get_type_hierarchy`**
    - Build type hierarchy showing inheritance relationships
    - Inputs: `file_path`, `line`, `character`
    - Returns: Type hierarchy preparation data

18. **`get_supertypes`**
    - Find all parent types that this type inherits from
    - Inputs: `item` (from get_type_hierarchy)
    - Returns: Array of parent type items

19. **`get_subtypes`**
    - Find all subtypes that inherit from this type
    - Inputs: `item` (from get_type_hierarchy)
    - Returns: Array of derived type items

### Code Intelligence Tools

20. **`get_completions`**
    - Get completions and auto-suggestions at cursor position
    - Inputs: `file_path`, `line`, `character`
    - Returns: Array of completion suggestions with documentation

21. **`get_resolves`**
    - Resolve additional details for a completion item
    - Inputs: `file_path`, `item` (from get_completions)
    - Returns: Extended completion information and documentation

22. **`get_signature`**
    - Show function parameters and signature help at cursor position
    - Inputs: `file_path`, `line`, `character`
    - Returns: Function signature information and parameter details

23. **`get_inlay_hints`**
    - Show inline type annotations and parameter hints in code range
    - Inputs: `file_path`, `start_line`, `start_character`, `end_line`, `end_character`
    - Returns: Array of inline type hints and annotations

24. **`get_inlay_hint`**
    - Resolve additional details for an inlay hint item
    - Inputs: `file_path`, `item` (from get_inlay_hints)
    - Returns: Extended inlay hint information

### Document Tools

25. **`get_symbols`**
    - List all symbols in document with pagination
    - Inputs: `file_path`, `limit` (optional), `offset` (optional)
    - Returns: Paginated document outline with functions, classes, variables

26. **`get_highlights`**
    - Highlight all occurrences of symbol at cursor position
    - Inputs: `file_path`, `line`, `character`
    - Returns: Array of symbol highlight ranges

27. **`get_folding_ranges`**
    - Identify collapsible code sections for code editor folding
    - Inputs: `file_path`
    - Returns: Array of foldable code ranges

28. **`get_colors`**
    - Extract color definitions and references from document
    - Inputs: `file_path`
    - Returns: Array of color values and their locations

29. **`get_diagnostics`**
    - Get errors, warnings, and diagnostics from document
    - Inputs: `file_path`
    - Returns: Array of diagnostics with severity, message, and location

30. **`get_links`**
    - Extract clickable links and references from document
    - Inputs: `file_path`
    - Returns: Array of document links and references

31. **`get_link_resolves`**
    - Resolve target URL for a document link item
    - Inputs: `file_path`, `item` (from get_links)
    - Returns: Resolved link target information

32. **`get_semantic_tokens`**
    - Extract detailed syntax tokens for advanced highlighting and analysis
    - Inputs: `file_path`
    - Returns: Semantic token data with types and modifiers

### Formatting & Editing Tools

33. **`get_format`**
    - Format entire document using language server rules
    - Inputs: `file_path`
    - Returns: Formatted document text with applied style rules

34. **`get_range_format`**
    - Format specific code range using language server rules
    - Inputs: `file_path`, `start_line`, `start_character`, `end_line`, `end_character`
    - Returns: Formatted range with style rules applied

35. **`get_code_actions`**
    - Get automated code fixes and refactoring suggestions at cursor position
    - Inputs: `file_path`, `line`, `character`
    - Returns: Array of available code actions and quick fixes

36. **`get_code_resolves`**
    - Resolve additional details for a code action item
    - Inputs: `file_path`, `item` (from get_code_actions)
    - Returns: Complete code action with workspace edits

37. **`get_selection_range`**
    - Expand selection to logical code boundaries
    - Inputs: `file_path`, `line`, `character`
    - Returns: Array of expanded selection ranges

38. **`get_linked_editing_range`**
    - Find related ranges that should be edited simultaneously
    - Inputs: `file_path`, `line`, `character`
    - Returns: Linked editing ranges for synchronized updates

39. **`get_symbol_renames`**
    - Preview all locations that would be renamed with symbol
    - Inputs: `file_path`, `line`, `character`, `new_name`
    - Returns: Workspace edit preview for symbol renaming
