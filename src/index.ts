#!/usr/bin/env node
/**
 * LSP MCP Server Entry Point
 * 
 * Main entry point for the LSP MCP server application. Handles environment
 * validation, server initialization, and transport setup.
 * 
 * @module index
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { LspMcpServer } from './server/mcp.js';

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
    if (error.message.includes('EPIPE') || (error as any).code === 'EPIPE') {
      console.error('EPIPE error caught - continuing operation');
      return;
    }
    console.error('Fatal error:', error);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    if (reason && typeof reason === 'object' &&
      ((reason as any).code === 'EPIPE' || (reason as Error).message?.includes('EPIPE'))) {
      console.error('EPIPE rejection caught - continuing operation');
      return;
    }
  });
  const lspFilePath = process.env.LSP_FILE_PATH;
  if (!lspFilePath) {
    console.error('Please set LSP_FILE_PATH environment variable');
    process.exit(1);
  }
  const lspServer = new LspMcpServer(lspFilePath);
  const transport = new StdioServerTransport();
  try {
    await lspServer.connect(transport);
  } catch (error) {
    console.error('Failed to connect MCP transport:', error);
  }
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
