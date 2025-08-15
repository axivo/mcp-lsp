/**
 * LSP Configuration Parser
 * 
 * @module server/config
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { readFileSync } from 'fs';

interface Config {
  servers: Record<string, ServerConfig>;
}

interface ServerConfig {
  command: string;
  args: string[];
  projects: string[];
  extensions: string[];
}

/**
 * LSP Configuration Parser
 * 
 * Handles parsing and validation of LSP server configuration files with
 * comprehensive error handling and validation.
 * 
 * @class LspConfigParser
 */
export class LspConfigParser {
  private config: Config;

  /**
   * Creates a new LspConfigParser instance
   * 
   * @param {string} configPath - Path to the LSP configuration file
   */
  constructor(configPath: string) {
    this.config = this.loadConfig(configPath);
  }

  /**
   * Loads and parses the configuration file
   * 
   * @private
   * @param {string} configPath - Path to the configuration file
   * @returns {Config} Parsed and validated configuration
   * @throws {Error} When file cannot be read or parsed
   */
  private loadConfig(configPath: string): Config {
    try {
      const configContent = readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);
      this.validateConfig(config);
      return config;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`LSP configuration file not found: ${configPath}`);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in LSP configuration file: ${error.message}`);
      }
      throw new Error(`Failed to read LSP configuration file: ${error}`);
    }
  }

  /**
   * Validates the configuration structure and content
   * 
   * @private
   * @param {Config} config - Configuration to validate
   * @throws {Error} When configuration is invalid
   */
  private validateConfig(config: Config): void {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be a valid object');
    }
    if (!config.servers || typeof config.servers !== 'object') {
      throw new Error("Configuration must have a 'servers' object");
    }
    if (Object.keys(config.servers).length === 0) {
      throw new Error('Configuration must define at least one language server');
    }
    for (const [languageId, serverConfig] of Object.entries(config.servers)) {
      if (!serverConfig || typeof serverConfig !== 'object') {
        throw new Error(`Language server '${languageId}' configuration must be an object`);
      }
      if (typeof serverConfig.command !== 'string' || serverConfig.command.trim() === '') {
        throw new Error(`Language server '${languageId}' must have a valid command string`);
      }
      if (!Array.isArray(serverConfig.args)) {
        throw new Error(`Language server '${languageId}' args must be an array`);
      }
      if (!Array.isArray(serverConfig.extensions) || serverConfig.extensions.length === 0) {
        throw new Error(`Language server '${languageId}' must have at least one extension`);
      }
      if (!Array.isArray(serverConfig.projects) || serverConfig.projects.length === 0) {
        throw new Error(`Language server '${languageId}' must have at least one project directory`);
      }
    }
  }

  /**
   * Gets all configured servers
   * 
   * @returns {string[]} Array of server language identifiers
   */
  getServers(): string[] {
    return Object.keys(this.config.servers);
  }

  /**
   * Gets server configuration for a specific language
   * 
   * @param {string} languageId - Language identifier
   * @returns {Object | null} Server configuration or null if not found
   */
  getServerConfig(languageId: string): {
    command: string;
    args: string[];
    projects: string[];
    extensions: string[];
  } | null {
    const serverConfig = this.config.servers[languageId];
    if (!serverConfig) {
      return null;
    }
    return {
      command: serverConfig.command,
      args: serverConfig.args,
      projects: serverConfig.projects,
      extensions: serverConfig.extensions
    };
  }

  /**
   * Checks if a language server is configured
   * 
   * @param {string} languageId - Language identifier
   * @returns {boolean} True if server is configured
   */
  hasServerConfig(languageId: string): boolean {
    return languageId in this.config.servers;
  }
}
