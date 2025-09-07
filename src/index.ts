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

/**
 * Error interface for Node.js errors with error codes
 * 
 * Extends standard Error interface to include Node.js-specific error codes
 * for precise error classification and handling.
 * 
 * @interface CodeError
 * @property {string} code - Node.js error code identifier (e.g., 'EPIPE', 'ENOENT')
 */
interface CodeError {
  code: string;
}

/**
 * Checks if an error is an EPIPE error that should be handled gracefully
 * 
 * EPIPE (Broken Pipe) errors occur when the client disconnects unexpectedly
 * and are normal for MCP server operations. This function identifies such errors
 * to prevent unnecessary process termination.
 * 
 * @param {unknown} err - Error object to classify and check
 * @returns {boolean} True if error is EPIPE and should be ignored, false for other errors requiring handling
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
 * Main entry point for the LSP-MCP Server with comprehensive error handling
 * 
 * Initializes the language server protocol bridge for Model Context Protocol,
 * validates required environment configuration, establishes stdio communication
 * transport, and configures robust error handling for production deployment.
 * 
 * Environment Requirements:
 * - LSP_FILE_PATH: Absolute path to LSP server configuration JSON file
 * 
 * Error Handling:
 * - EPIPE errors are logged but don't terminate the process (normal client disconnection)
 * - Other uncaught exceptions terminate the process after logging
 * - Configuration errors exit with code 1
 * 
 * @async
 * @function main
 * @throws {Error} When LSP_FILE_PATH is missing or server initialization fails
 * @returns {Promise<void>} Promise that resolves when server is connected and listening
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
