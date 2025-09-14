/**
 * Configuration Parser and Validator
 * 
 * @module server/config
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { readFileSync } from 'node:fs';
import { ClientCapabilities } from 'vscode-languageserver-protocol';

/**
 * Top-level configuration structure for all language servers
 * 
 * @interface GlobalConfig
 * @property {Record<string, ServerConfig>} servers - Map of language IDs to server configurations
 */
interface GlobalConfig {
  servers: Record<string, ServerConfig>;
}

/**
 * Project configuration within a language server setup
 * 
 * @export
 * @interface ProjectConfig
 * @property {string} [description] - Optional human-readable project description
 * @property {string} name - Unique project identifier within language server
 * @property {string} path - Absolute path to project root directory
 * @property {{exclude?: string[], include?: string[]}} [patterns] - Optional glob patterns for file discovery
 * @property {string} [url] - Optional project URL for documentation or repository
 */
export interface ProjectConfig {
  description?: string;
  name: string;
  path: string;
  patterns?: {
    exclude?: string[];
    include?: string[];
  };
  url?: string;
}

/**
 * Language server configuration with runtime settings
 * 
 * @export
 * @interface ServerConfig
 * @property {string[]} args - Command line arguments for server process
 * @property {Partial<ClientCapabilities>} [capabilities] - Optional LSP client capability overrides
 * @property {string} command - Executable command to start language server
 * @property {Record<string, unknown>} [configuration] - Optional server-specific configuration
 * @property {string[]} extensions - File extensions handled by this server
 * @property {ProjectConfig[]} projects - Array of projects using this language server
 * @property {object} [settings] - Optional runtime behavior settings
 */
export interface ServerConfig {
  args: string[];
  capabilities?: Partial<ClientCapabilities>;
  command: string;
  configuration?: Record<string, unknown>;
  extensions: string[];
  projects: ProjectConfig[];
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
 * Configuration Parser and Validator
 * 
 * Handles parsing, validation, and access to LSP server configuration files
 * with comprehensive error handling, type safety, and default value management.
 * 
 * @export
 * @class Config
 */
export class Config {
  private config: GlobalConfig;

  /**
   * Creates a new Config instance and loads configuration
   * 
   * Automatically parses and validates the configuration file on instantiation,
   * providing safe access to language server settings with fallback handling.
   * 
   * @param {string} configPath - Absolute or relative path to the LSP configuration JSON file
   */
  constructor(configPath: string) {
    this.config = this.loadConfig(configPath);
  }

  /**
   * Loads and parses the configuration file with error handling
   * 
   * Reads JSON configuration file, validates structure and content,
   * and returns safe configuration object with fallback on any errors.
   * 
   * @private
   * @param {string} configPath - Path to the JSON configuration file
   * @returns {GlobalConfig} Parsed and validated configuration or empty fallback
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
   * Validates comprehensive configuration structure and content rules
   * 
   * Performs deep validation of configuration including server definitions,
   * project paths, file extensions, settings types, and pattern configurations
   * to ensure runtime safety and proper LSP server initialization.
   * 
   * @private
   * @param {GlobalConfig} config - Configuration object to validate against schema
   * @returns {boolean} True if configuration meets all validation requirements, false otherwise
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
      if (serverConfig.capabilities !== undefined) {
        if (typeof serverConfig.capabilities !== 'object' || serverConfig.capabilities === null || Array.isArray(serverConfig.capabilities)) {
          return false;
        }
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
   * Gets all configured language server identifiers
   * 
   * Returns array of language identifiers for all configured servers,
   * enabling iteration and server discovery operations.
   * 
   * @returns {string[]} Array of language server identifiers (e.g., ['typescript', 'python'])
   */
  getServers(): string[] {
    return Object.keys(this.config.servers);
  }

  /**
   * Gets complete server configuration with defaults for a specific language
   * 
   * Retrieves full server configuration including command, arguments, extensions,
   * projects, and runtime settings. Provides sensible defaults for missing
   * configurations and ensures type-safe access to all settings.
   * 
   * @param {string} languageId - Language identifier (e.g., 'typescript', 'python')
   * @returns {{
   *   args: string[],
   *   capabilities?: Partial<ClientCapabilities>,
   *   command: string,
   *   configuration?: Record<string, unknown>,
   *   extensions: string[],
   *   projects: ProjectConfig[],
   *   settings: {
   *     configurationRequest: boolean,
   *     maxConcurrentFileReads: number,
   *     messageRequest: boolean,
   *     rateLimitMaxRequests: number,
   *     rateLimitWindowMs: number,
   *     registrationRequest: boolean,
   *     shutdownGracePeriodMs: number,
   *     workspace: boolean
   *   }
   * }} Complete server configuration with applied defaults
   */
  getServerConfig(languageId: string): {
    args: string[];
    capabilities?: Partial<ClientCapabilities>;
    command: string;
    configuration?: Record<string, unknown>;
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
      capabilities: serverConfig.capabilities,
      command: serverConfig.command,
      configuration: serverConfig.configuration,
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
      }
    };
  }

  /**
   * Checks if a language server configuration exists
   * 
   * Validates whether a language server is properly configured
   * and available for use within the current configuration.
   * 
   * @param {string} languageId - Language identifier to check (e.g., 'typescript', 'python')
   * @returns {boolean} True if server is configured and available, false otherwise
   */
  hasServerConfig(languageId: string): boolean {
    return languageId in this.config.servers;
  }
}
