/**
 * LSP Configuration Parser
 * 
 * @module server/config
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { readFileSync } from 'node:fs';
import { ClientCapabilities } from 'vscode-languageserver-protocol';

interface GlobalConfig {
  servers: Record<string, ServerConfig>;
}

export interface ProjectConfig {
  name: string;
  path: string;
  capabilities?: Partial<ClientCapabilities>;
  description?: string;
  patterns?: {
    exclude?: string[];
    include?: string[];
  };
  url?: string;
}

interface ServerConfig {
  args: string[];
  command: string;
  extensions: string[];
  projects: ProjectConfig[];
  configuration?: Record<string, any>;
  settings?: {
    configurationRequest?: boolean;
    maxConcurrentFileReads?: number;
    messageRequest?: boolean;
    rateLimitMaxRequests?: number;
    rateLimitWindowMs?: number;
    registrationRequest?: boolean;
    shutdownGracePeriodMs?: number;
    workspace?: boolean;
  };
}

/**
 * LSP Configuration
 * 
 * Handles parsing and validation of LSP server configuration files with
 * comprehensive error handling and validation.
 * 
 * @class Config
 */
export class Config {
  private config: GlobalConfig;

  /**
   * Creates a new Config instance
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
   * @returns {GlobalConfig} Parsed and validated configuration
   */
  private loadConfig(configPath: string): GlobalConfig {
    const emptyConfig = { servers: {} };
    try {
      const configContent = readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);
      if (!this.validate(config)) {
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
   * @param {GlobalConfig} config - Configuration to validate
   * @returns {boolean} True if configuration is valid, false otherwise
   */
  private validate(config: GlobalConfig): boolean {
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
      if (!Array.isArray(serverConfig.args)) {
        return false;
      }
      if (typeof serverConfig.command !== 'string' || serverConfig.command.trim() === '') {
        return false;
      }
      if (serverConfig.configuration !== undefined &&
        (typeof serverConfig.configuration !== 'object' || serverConfig.configuration === null || Array.isArray(serverConfig.configuration))
      ) {
        return false;
      }
      if (!Array.isArray(serverConfig.extensions) || serverConfig.extensions.length === 0) {
        return false;
      }
      if (!Array.isArray(serverConfig.projects) || serverConfig.projects.length === 0) {
        return false;
      }
      if (serverConfig.settings !== undefined) {
        if (typeof serverConfig.settings !== 'object' || serverConfig.settings === null || Array.isArray(serverConfig.settings)) {
          return false;
        }
        if (serverConfig.settings.configurationRequest !== undefined && typeof serverConfig.settings.configurationRequest !== 'boolean') {
          return false;
        }
        if (serverConfig.settings.messageRequest !== undefined && typeof serverConfig.settings.messageRequest !== 'boolean') {
          return false;
        }
        if (serverConfig.settings.registrationRequest !== undefined && typeof serverConfig.settings.registrationRequest !== 'boolean') {
          return false;
        }
        if (serverConfig.settings.workspace !== undefined && typeof serverConfig.settings.workspace !== 'boolean') {
          return false;
        }
      }
      for (const project of serverConfig.projects) {
        if (!project || typeof project !== 'object') {
          return false;
        }
        if (typeof project.name !== 'string' || project.name.trim() === '') {
          return false;
        }
        if (project.capabilities !== undefined) {
          if (typeof project.capabilities !== 'object' || project.capabilities === null || Array.isArray(project.capabilities)) {
            return false;
          }
        }
        if (project.description !== undefined && (typeof project.description !== 'string' || project.description.trim() === '')) {
          return false;
        }
        if (project.patterns !== undefined) {
          if (typeof project.patterns !== 'object' || project.patterns === null || Array.isArray(project.patterns)) {
            return false;
          }
          if (project.patterns.exclude !== undefined && !Array.isArray(project.patterns.exclude)) {
            return false;
          }
          if (project.patterns.include !== undefined && !Array.isArray(project.patterns.include)) {
            return false;
          }
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
    args: string[];
    command: string;
    extensions: string[];
    projects: ProjectConfig[];
    settings: {
      configurationRequest: boolean;
      maxConcurrentFileReads: number;
      messageRequest: boolean;
      rateLimitMaxRequests: number;
      rateLimitWindowMs: number;
      registrationRequest: boolean;
      shutdownGracePeriodMs: number;
      workspace: boolean;
    };
    configuration?: Record<string, any>;
  } {
    const serverConfig = this.config.servers[languageId];
    if (!serverConfig) {
      return {
        args: [],
        command: '',
        extensions: [],
        projects: [],
        settings: {
          configurationRequest: false,
          maxConcurrentFileReads: 10,
          messageRequest: true,
          rateLimitMaxRequests: 100,
          rateLimitWindowMs: 60000,
          registrationRequest: true,
          shutdownGracePeriodMs: 100,
          workspace: true
        },
        configuration: undefined
      };
    }
    return {
      args: serverConfig.args,
      command: serverConfig.command,
      extensions: serverConfig.extensions,
      projects: serverConfig.projects,
      settings: {
        configurationRequest: serverConfig.settings?.configurationRequest ?? false,
        maxConcurrentFileReads: serverConfig.settings?.maxConcurrentFileReads ?? 10,
        messageRequest: serverConfig.settings?.messageRequest ?? true,
        rateLimitMaxRequests: serverConfig.settings?.rateLimitMaxRequests ?? 100,
        rateLimitWindowMs: serverConfig.settings?.rateLimitWindowMs ?? 60000,
        registrationRequest: serverConfig.settings?.registrationRequest ?? true,
        shutdownGracePeriodMs: serverConfig.settings?.shutdownGracePeriodMs ?? 100,
        workspace: serverConfig.settings?.workspace ?? true
      },
      configuration: serverConfig.configuration
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
