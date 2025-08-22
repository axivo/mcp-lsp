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

export interface ProjectConfig {
  name: string;
  description: string;
  url?: string;
  ignore: string[];
  path: string;
}

interface ServerConfig {
  command: string;
  args: string[];
  extensions: string[];
  projects: ProjectConfig[];
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
   */
  private loadConfig(configPath: string): Config {
    const emptyConfig = { servers: {} };
    try {
      const configContent = readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);
      if (!this.validateConfig(config)) {
        return emptyConfig;
      }
      return config;
    } catch (error) {
      return emptyConfig;
    }
  }

  /**
   * Validates the configuration structure and content
   * 
   * @private
   * @param {Config} config - Configuration to validate
   * @returns {boolean} True if configuration is valid, false otherwise
   */
  private validateConfig(config: Config): boolean {
    if (!config || typeof config !== 'object') {
      return false;
    }
    if (!config.servers || typeof config.servers !== 'object') {
      return false;
    }
    if (Object.keys(config.servers).length === 0) {
      return false;
    }
    for (const serverConfig of Object.values(config.servers)) {
      if (!serverConfig || typeof serverConfig !== 'object') {
        return false;
      }
      if (typeof serverConfig.command !== 'string' || serverConfig.command.trim() === '') {
        return false;
      }
      if (!Array.isArray(serverConfig.args)) {
        return false;
      }
      if (!Array.isArray(serverConfig.extensions) || serverConfig.extensions.length === 0) {
        return false;
      }
      if (!Array.isArray(serverConfig.projects) || serverConfig.projects.length === 0) {
        return false;
      }
      for (const project of serverConfig.projects) {
        if (!project || typeof project !== 'object') {
          return false;
        }
        if (typeof project.name !== 'string' || project.name.trim() === '') {
          return false;
        }
        if (typeof project.description !== 'string' || project.description.trim() === '') {
          return false;
        }
        if (!Array.isArray(project.ignore)) {
          return false;
        }
        if (typeof project.path !== 'string' || project.path.trim() === '') {
          return false;
        }
      }
    }
    return true;
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
   * @returns {Object} Server configuration
   */
  getServerConfig(languageId: string): {
    command: string;
    args: string[];
    extensions: string[];
    projects: ProjectConfig[];
  } {
    const serverConfig = this.config.servers[languageId];
    if (!serverConfig) {
      return {
        command: '',
        args: [],
        extensions: [],
        projects: []
      };
    }
    return {
      command: serverConfig.command,
      args: serverConfig.args,
      extensions: serverConfig.extensions,
      projects: serverConfig.projects
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
