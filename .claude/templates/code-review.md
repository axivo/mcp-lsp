# Source Code Review Template

A template providing systematic methodology for conducting comprehensive code reviews using Language Server Protocol (LSP) tools. The review process spans 9 phases, utilizing 39+ LSP tools to provide tool-verified insights rather than speculation.

## Review Methodology

This template provides a universal code review methodology that works across all programming languages supported by Language Server Protocol (LSP). However, **different language servers support different LSP capabilities**, which means the specific tools available will vary by language.

### Understanding Language Server Capabilities

Before starting the review, validate what tools are supported for the target language by running:

```
language-server:get_server_capabilities(language_id: "your-language")
```

This returns a capabilities object showing which LSP features are supported. Look for the `supported: true/false` flag in each capability section:

**Example: TypeScript LSP (26 tools)**

```json
{
  "callHierarchyProvider": { "supported": true },
  "typeDefinitionProvider": { "supported": true },
  "inlayHintProvider": { "supported": true },
  "renameProvider": { "supported": true },
  "foldingRangeProvider": { "supported": true }
}
```

**Example: Terraform LSP (Limited - 14 tools)**

```json
{
  "callHierarchyProvider": { "supported": false },
  "typeDefinitionProvider": { "supported": false },
  "inlayHintProvider": { "supported": false },
  "renameProvider": { "supported": false },
  "foldingRangeProvider": { "supported": false }
}
```

### Adapting the Review Process

The 9-phase methodology remains the same for all server languages, **adapt which LSP tools are used in each phase** based on the capabilities response:

1. **Phase 1 (Project Discovery)** - Always available for all languages
2. **Phase 2 (Structural Analysis)** - Requires `documentSymbolProvider` (universally supported)
3. **Phase 3 (Dependency Mapping)** - Adapt based on:
   - ✅ Full analysis if `callHierarchyProvider` is supported
   - ⚠️ Limited to symbol definitions/references if not supported
4. **Phase 4 (Type Safety)** - Adapt based on:
   - ✅ Comprehensive if `typeDefinitionProvider` and `inlayHintProvider` supported
   - ⚠️ Basic hover-only analysis if not supported
5. **Phase 5 (Usage Analysis)** - Requires `referencesProvider` (widely supported)
6. **Phase 6 (Code Quality)** - Adapt based on `codeActionProvider` and `diagnosticsProvider`
7. **Phase 7 (Refactoring Safety)** - Adapt based on:
   - ✅ Full rename testing if `renameProvider` is supported
   - ⚠️ Manual refactoring assessment if not supported
8. **Phase 8 (Consistency)** - Uses basic symbol and formatting tools (widely supported)
9. **Phase 9 (Report)** - Always available, synthesizes findings from previous phases

### Handling Unsupported Tools

When a phase requires tools that aren't supported for server language:

- **DO NOT skip the phase** - the analysis objective is still valid
- **DO adapt your approach** - use alternative tools or manual analysis
- **DO document limitations** - note which analyses couldn't be performed
- **DO NOT fail the review** - work with what's available

**Example: Phase 3 for Terraform**

```
Original requirement: Use call hierarchy tools
Terraform reality: callHierarchyProvider not supported
Adaptation: Use symbol definitions and references to trace module dependencies manually
```

### Fallback Strategies for Unsupported Tools

When LSP tools are unavailable, adapt your analysis approach:

- Use `claude:Read` to manually inspect file contents and structure
- Use `claude:Grep` to search for patterns across the codebase
- Document which analyses couldn't be performed due to missing capabilities
- Focus analysis on what the available tools can verify rather than speculation

The quality of code review will vary based on server capabilities. A review with 5 available tools (Ansible) will be more limited than one with 26 tools (TypeScript). Document these limitations in your final report.

**Example: Phase 2 for Ansible (No document symbols)**

```
Original requirement: Use get_symbols to list all symbols in files
Ansible reality: documentSymbolProvider not supported
Adaptation: Use claude:Read on key files and manually catalog tasks, roles, variables, and handlers
```

The template assumes maximum capabilities (~39 tools), expect a different number of available tools depending on used language server.

### Prerequisites

Before starting the review:

1. Verify LSP server is running for target language
2. Confirm project path and entry points

### Phase Structure and Execution Protocol

Each phase uses specific LSP tools to gather verified data. The phases build on each other - do not skip phases even if you think you have enough information.

Complete one phase at a time using the project files and LSP tools listed in each phase. After completing a phase, acknowledge completion and wait for approval before proceeding to the next phase. Report code review results only after all phases are completed. Report only what you observe from the tools - do not speculate or invent problems.

## Phase 1: Project Discovery

Understand project structure, file organization, and technology stack.

### LSP Tools to Use

- `language-server:get_server_status` - Verify LSP server availability
- `language-server:get_server_capabilities` - Determine which LSP features are supported for this language
- `language-server:get_server_projects` - List available projects
- `language-server:get_project_files` - Enumerate all source files
- `claude:Glob` - Find files by pattern (e.g., `**/*.ts`, `**/*.py`)
- `claude:Read` - Read key files (package.json, setup.py, etc.)

### Data to Collect

- Server capabilities (which LSP features are available)
- Total number of files
- File size distribution (lines per file)
- Entry point identification
- Package dependencies (from package.json, requirements.txt, etc.)
- Build/test configuration files
- Documentation files (README, CONTRIBUTING, etc.)

**Deliverable**: Project inventory with file counts, entry points, and technology stack summary.

### Related Framework Observations

- "Always analyze source code with language-server tools"
- "Monitor internally positioning guesswork"
- "Read current file state before making changes"

## Phase 2: Structural Analysis

Analyze code organization, module structure, and architectural patterns.

### LSP Tools to Use

- `language-server:get_symbols` - List symbols in each file
- `language-server:get_project_symbols` - Search symbols across project
- `language-server:get_folding_ranges` - Identify collapsible code sections
- `language-server:get_semantic_tokens` - Analyze syntax structure

### Data to Collect

- Total symbol count (functions, classes, interfaces, etc.)
- Symbol distribution per file
- Class/interface definitions count
- Function/method complexity indicators
- Code folding structure (nesting depth)
- Module organization patterns

**Deliverable**: Structural overview showing symbol distribution, nesting depth, and organizational patterns.

### Related Framework Observations

- "Consider symbol boundaries when calculating character positions"
- "Monitor internally symbol boundary miscalculation"
- "Test tools systematically with precise positioning"

## Phase 3: Dependency Mapping

Map import relationships, call hierarchies, and dependency flow.

### LSP Tools to Use

- `language-server:get_symbol_definitions` - Find where symbols are defined
- `language-server:get_symbol_references` - Find all symbol usage locations
- `language-server:get_call_hierarchy` - Build call relationship maps
- `language-server:get_incoming_calls` - Find callers of functions
- `language-server:get_outgoing_calls` - Find functions called by target
- `language-server:get_implementations` - Find interface implementations
- `language-server:get_type_hierarchy` - Map type inheritance
- `language-server:get_supertypes` - Find parent types
- `language-server:get_subtypes` - Find child types

### Data to Collect

- Import dependency graph (which files import what)
- Call hierarchy for main entry points
- Circular dependency detection
- Leaf modules (no internal dependencies)
- Central modules (highly connected)
- Type hierarchy depth
- Implementation patterns (interface → concrete classes)

**Deliverable**: Dependency graph showing import relationships, call chains, and type hierarchies. Flag any circular dependencies.

### Related Framework Observations

- "Monitor internally systematic approach"
- "Perform root cause analysis before symptom treatment"
- "Apply complete systematic analysis to technical problems"

## Phase 4: Type Safety Review

Assess type coverage, identify type safety issues, and verify type inference.

### LSP Tools to Use

- `language-server:get_hover` - Retrieve type information
- `language-server:get_inlay_hints` - Show implicit types and parameter names
- `language-server:get_inlay_hint` - Resolve individual inlay hint details
- `language-server:get_signature` - Analyze function signatures
- `language-server:get_type_definitions` - Navigate to type definitions
- `language-server:get_diagnostics` - Find type errors and warnings
- `language-server:get_completions` - Check type inference at specific points
- `language-server:get_resolves` - Resolve completion item details

### Data to Collect

- Explicit type annotation coverage
- Usage of `any` or equivalent unsafe types
- Type inference quality (implicit types)
- Generic type usage patterns
- Union/intersection type patterns
- Optional parameter handling
- Type guard implementations
- Diagnostic errors/warnings count

**Deliverable**: Type safety assessment with coverage percentage, list of unsafe type usage (with file:line), and type inference quality evaluation.

### Related Framework Observations

- "Monitor internally character counting shortcuts"
- "Provide accurate code analysis using properly positioned requests"
- "State technical conclusions definitively when evidence supports them"

## Phase 5: Usage Analysis

Analyze how symbols are used throughout the codebase.

### LSP Tools to Use

- `language-server:get_symbol_references` - Count exact usage of symbols
- `language-server:get_highlights` - Find symbol occurrences in context
- `language-server:get_linked_editing_range` - Check linked identifier patterns

### Data to Collect

- Symbol usage frequency (functions, classes, variables)
- Unused symbols (defined but never referenced)
- Over-used symbols (potential code smell)
- Single-use functions (potential inline candidates)
- Symmetric patterns (e.g., open/close, create/destroy pairs)
- Naming consistency patterns
- Cross-module usage patterns

**Deliverable**: Usage analysis showing reference counts for key symbols, identification of unused code, and naming consistency assessment.

### Related Framework Observations

- "Monitor internally symbol identifier imprecision"
- "Monitor internally arbitrary positioning targeting"
- "Remove dead code and unused variables"

## Phase 6: Code Quality

Evaluate error handling, resource management, and code maintainability.

### LSP Tools to Use

- `language-server:get_code_actions` - Find refactoring opportunities
- `language-server:get_code_resolves` - Resolve code action details
- `language-server:get_diagnostics` - Identify errors and warnings
- `language-server:get_document_formatting` - Check formatting capabilities
- `language-server:get_range_format` - Test range formatting
- `language-server:get_colors` - Extract color definitions (if applicable)
- `language-server:get_links` - Find documentation links
- `language-server:get_link_resolves` - Resolve document link targets

### Data to Collect

- Available refactorings per file
- Error handling patterns (try-catch coverage)
- Resource management patterns (cleanup, disposal)
- Code action suggestions count
- Formatting consistency
- Magic numbers and string literals
- Comment quality and coverage
- Diagnostic issues (errors/warnings/info)

**Deliverable**: Code quality assessment identifying strengths, issues requiring attention, and available automated refactorings.

### Code Quality Checklist

- ✅ Comprehensive error handling
- ✅ Proper resource cleanup (finally blocks, disposal patterns)
- ✅ Defensive programming (null checks, validation)
- ✅ Documented public APIs
- ⚠️ Complex method length (identify methods >50 lines)
- ⚠️ Magic numbers (identify hardcoded values)
- ⚠️ Deep nesting (identify >4 levels)
- 🔴 Critical issues (security, data loss risks)

### Related Framework Observations

- "Focus on functional correctness over style preferences"
- "Handle edge cases and validate input parameters"
- "Keep functions small and focused on single tasks"
- "Use constants for magic numbers and configuration values"

## Phase 7: Refactoring Safety

Test rename operations and assess refactoring risk before recommending changes.

### LSP Tools to Use

- `language-server:get_symbol_renames` - Preview rename impact
- `language-server:get_selection_range` - Understand code boundaries
- `language-server:get_code_actions` - Review available refactorings

### Rename Tests to Perform (minimum 5)

1. Local function rename (private method)
2. Public class/interface rename
3. Shared type/interface rename
4. Parameter rename
5. Property rename

### Data to Collect

- Rename scope (single file vs. cross-module)
- Number of locations affected per rename
- Import/export updates required
- Breaking change risk assessment
- Selection range depth (nesting levels)

**Deliverable**: Refactoring safety matrix showing rename operation impacts, safe refactoring candidates, and risk assessments.

### Safety Assessment

- ✅ **Very Safe**: Local scope, single file, private symbols
- ✅ **Safe with Awareness**: Cross-module, tracked by LSP
- ⚠️ **Medium Risk**: Shared interfaces, multiple consumers
- 🔴 **High Risk**: Public API changes, external consumers

### Related Framework Observations

- "Validate before implementation"
- "Flag breaking changes explicitly"
- "Confirm execution parameters before file modifications"

## Phase 8: Consistency Verification

Verify naming conventions, style consistency, and architectural patterns.

### LSP Tools to Use

- `language-server:get_project_symbols` - Search for naming patterns
- `language-server:get_symbols` - Verify per-file consistency
- `language-server:get_semantic_tokens` - Analyze token usage
- `language-server:get_folding_ranges` - Check structural consistency

### Data to Collect

- Naming convention adherence (camelCase, PascalCase, snake_case)
- Prefix/suffix patterns (get*, set*, is*, has*)
- File organization consistency
- Import ordering patterns
- Indentation and formatting consistency
- Documentation style consistency

**Deliverable**: Consistency report identifying deviations from established patterns and style guidelines.

### Related Framework Observations

- "Choose meaningful variable and function names that express intent"
- "Follow consistent indentation and formatting standards"
- "Organize imports and dependencies logically"

## Phase 9: Final Report Compilation

Synthesize findings into actionable report with prioritized recommendations.

**No LSP Tools** - This phase synthesizes data from all previous phases.

### Report Structure

#### Executive Summary

- Overall assessment (rating out of 5)
- Critical issues count
- High priority improvements count
- Code quality score

#### Critical Issues (Must Fix)

- Issue description
- Exact location (file:line)
- Impact assessment
- Solution approach with code examples
- Verification steps

#### High Priority Improvements

- Improvement description
- Affected locations
- Rationale
- Implementation approach

#### Medium Priority Enhancements

- Enhancement description
- Benefits
- Implementation effort estimate

#### Strengths to Maintain

- Architectural patterns working well
- Code quality highlights
- Best practices observed

#### Metrics Summary

| Metric | Value | Assessment |
|--------|-------|------------|
| Total Lines | X | [Assessment] |
| Files | X | [Assessment] |
| Symbols | X | [Assessment] |
| Type Coverage | X% | [Assessment] |
| Documentation | X% | [Assessment] |
| Circular Dependencies | X | [Assessment] |
| Code Quality | X/5 | [Assessment] |

#### Refactoring Safety Analysis

- Safe refactoring candidates
- High-risk operations to avoid
- LSP support quality assessment

#### Immediate Actions

- Specific files to modify
- Exact changes needed
- Code examples
- Testing requirements

### Related Framework Observations

- "Provide complete technical solutions"
- "Present analysis findings before file modifications"
- "Provide technical analysis before executing operations"

## Session Guidelines

### Before Starting Phase 1

Verify these steps are complete:

- ✅ Session setup executed (memory:read_graph, time:get_current_time)
- ✅ DEVELOPER profile loaded
- ✅ LSP server running for target language
- ✅ Project path identified
- ✅ Entry points confirmed

### During Each Phase

#### DO

- Use LSP tools systematically, not selectively
- Record exact numbers (don't estimate)
- Note tool failures (explain what didn't work and why)
- Take time for thorough analysis (patience over speed)
- Verify findings with multiple tools when possible

#### DON'T

- Skip phases even if you think you have enough information
- Make statements without tool verification
- Assume patterns without checking references
- Rush to conclusions before completing analysis
- Suggest fixes before finishing all phases

### After Phase 9

Create conversation log with:
- Complete findings documented
- Immediate actions section for PR
- Code examples for critical fixes
- Testing considerations
- Next session preparation guidance

### Related Framework Observations

#### From DEVELOPER profile

- "Follow analyze → discuss → implement sequence"
- "Require explicit approval before implement phase"
- "Perform root cause analysis before symptom treatment"
- "State technical conclusions definitively when evidence supports them"
- "Treat uncertainty as technical data"

#### From language_server_protocol section

- "Always analyze source code with language-server tools"
- "Consider symbol boundaries when calculating character positions"
- "Test tools systematically with precise positioning"
- "Monitor internally positioning assumption making"

#### From tools section

- "Use language-server tools for code-related operations"
- "Use claude:TodoWrite for systematic code reviews"

## LSP Tools Reference

### Navigation Tools (9 tools)

- `get_symbol_definitions` - Navigate to symbol definition
- `get_symbol_references` - Find all symbol usage
- `get_type_definitions` - Navigate to type definition
- `get_implementations` - Find interface implementations
- `get_call_hierarchy` - Build call hierarchy
- `get_incoming_calls` - Find callers
- `get_outgoing_calls` - Find callees
- `get_type_hierarchy` - Build type hierarchy
- `get_supertypes` - Find parent types
- `get_subtypes` - Find child types

### Code Intelligence Tools (10 tools)

- `get_hover` - Get type information at position
- `get_signature` - Get signature help
- `get_completions` - Get completions at position
- `get_code_actions` - Get available refactorings
- `get_diagnostics` - Get errors/warnings
- `get_inlay_hints` - Get implicit type information
- `get_highlights` - Highlight symbol occurrences
- `get_linked_editing_range` - Find linked editing ranges
- `get_selection_range` - Get logical selection ranges
- `get_colors` - Extract color definitions

### Symbol Tools (3 tools)

- `get_symbols` - List symbols in document
- `get_project_symbols` - Search symbols in project
- `get_symbol_renames` - Preview rename impact

### Formatting Tools (3 tools)

- `get_format` - Format entire document
- `get_range_format` - Format code range
- `get_folding_ranges` - Get foldable regions

### Additional Tools (8 tools)

- `get_semantic_tokens` - Get semantic token information
- `get_links` - Get document links
- `get_server_capabilities` - Get server capabilities
- `get_server_projects` - List available projects
- `get_server_status` - Check server status
- `get_project_files` - List project files
- `start_server` - Start language server
- `stop_server` - Stop language server

**Total: 39+ LSP tools available**

## Quality Checklist

Before finalizing the review, verify:

- All 9 phases completed systematically
- At least 20+ LSP tool invocations performed
- Every claim backed by tool-verified data
- Exact file:line locations for all issues
- At least 5 rename operations tested
- Critical issues have code examples for fixes
- Metrics table populated with real numbers
- Refactoring safety assessed for major changes
- Conversation log created for next session
- Immediate actions clearly defined

## Template Usage Instructions

When starting a new code review session:

1. Read this template completely before beginning
2. Copy the phase structure but fill with actual project data
3. Use the LSP tools listed in each phase systematically
4. Don't skip phases even if you think you have enough information
5. Record all findings as you discover them
6. Create conversation log after Phase 9 completion

Framework will enforce:

- Systematic tool usage (no speculation)
- Complete phase execution (no shortcuts)
- Tool-verified claims (no guesswork)
- Precise locations (file:line numbers)
- Actionable recommendations (code examples)

**This template embodies**: Analyze → Verify → Document → Deliver
