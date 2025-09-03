#!/usr/bin/env node
/**
 * MCP Server Entry Point
 * 
 * @module index
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from './server/mcp.js';

interface CodeError {
  code: string;
}

/**
 * Check if an error is an EPIPE error that should be ignored
 * 
 * @param {unknown} err - The error to check
 * @returns {boolean} True if this is an EPIPE error, false otherwise
 */
function isEpipeError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  if (err.message?.includes('EPIPE') || ('code' in err && (err as CodeError).code === 'EPIPE')) {
    return true;
  }
  return false;
}

/**
 * Main entry point for the LSP MCP Server
 * 
 * Validates environment variables, initializes the LspMcpServer,
 * and establishes stdio transport for communication with Claude agents.
 * 
 * @async
 * @function main
 * @throws {Error} When required environment variables are missing or server initialization fails
 */
async function main(): Promise<void> {
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error.message);
    if (isEpipeError(error)) {
      console.error('EPIPE error caught, continuing operation.');
      return;
    }
    console.error('Fatal error:', error);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    if (reason && isEpipeError(reason)) {
      console.error('EPIPE rejection caught, continuing operation.');
      return;
    }
  });
  const filePath = process.env.LSP_FILE_PATH;
  if (!filePath) {
    console.error('Please set LSP_FILE_PATH environment variable.');
    process.exit(1);
  }
  const mcpServer = new McpServer(filePath);
  const transport = new StdioServerTransport();
  try {
    await mcpServer.connect(transport);
  } catch (error) {
    console.error('Failed to connect MCP transport:', error);
  }
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
