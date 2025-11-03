/**
 * Logging utility for MCP server
 * 
 * @module server/logger
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { LoggingLevel } from '@modelcontextprotocol/sdk/types.js';
import { Config } from './config.js';

/**
 * Log message parameters
 * 
 * @interface LogMessage
 * @property {string} languageId - Language server identifier
 * @property {LoggingLevel} level - Log severity level
 * @property {string} message - Log message content
 */
interface LogMessage {
  languageId: string;
  level: LoggingLevel;
  message: string;
}

/**
 * Logger for MCP server with severity-based filtering
 * 
 * Provides structured logging through MCP protocol with syslog hierarchy
 * filtering based on configured logging levels per language server.
 * 
 * @export
 * @class Logger
 */
export class Logger {
  private config: Config;
  private server: Server;

  /**
   * Creates a new Logger instance
   * 
   * @param {Config} config - Configuration instance for reading logging levels
   * @param {Server} server - MCP server instance for sending log messages
   */
  constructor(config: Config, server: Server) {
    this.config = config;
    this.server = server;
  }

  /**
   * Sends structured logging message via MCP protocol
   * 
   * Emits log messages with severity-based filtering using syslog hierarchy.
   * Messages are only sent if their severity meets or exceeds the configured
   * loggingLevel threshold for the language server.
   * 
   * @param {LogMessage} args - Log message parameters
   * @returns {Promise<void>} Promise that resolves when message is sent
   */
  async log(args: LogMessage): Promise<void> {
    const loggingLevel = this.getLoggingLevel(args.languageId);
    const level: LoggingLevel[] = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];
    const messageIndex = level.indexOf(args.level);
    const configIndex = level.indexOf(loggingLevel);
    if (messageIndex < configIndex) {
      return;
    }
    await this.server.sendLoggingMessage({
      level: args.level,
      data: args.message
    });
  }

  /**
   * Retrieves configured logging level for language server
   * 
   * Reads loggingLevel setting from server configuration to determine
   * which log messages should be emitted based on severity filtering.
   * Defaults to 'info' if not configured.
   * 
   * @private
   * @param {string} languageId - Language server identifier
   * @returns {LoggingLevel} Configured logging level or 'info' if not set
   */
  private getLoggingLevel(languageId: string): LoggingLevel {
    const serverConfig = this.config.getServerConfig(languageId);
    return serverConfig.settings.loggingLevel ?? 'info';
  }
}
