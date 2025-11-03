/**
 * Configuration Parser and Validator
 * 
 * @module server/config
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { readFileSync } from 'node:fs';
import { ClientCapabilities } from 'vscode-languageserver-protocol';
import { z } from 'zod';

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
 * @property {Record<string, string>} [env] - Optional environment settings
 * @property {string[]} extensions - File extensions handled by this server
 * @property {string[]} [init] - Optional commands to run before starting language server
 * @property {ProjectConfig[]} projects - Array of projects using this language server
 * @property {object} [settings] - Optional runtime behavior settings
 */
export interface ServerConfig {
  args: string[];
  capabilities?: Partial<ClientCapabilities>;
  command: string;
  configuration?: Record<string, unknown>;
  env?: Record<string, string>;
  extensions: string[];
  init?: string[];
  projects: ProjectConfig[];
  settings?: {
    loggingLevel?: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
    maxConcurrentFileReads?: number;
    rateLimitMaxRequests?: number;
    rateLimitWindowMs?: number;
    shutdownGracePeriodMs?: number;
    timeoutMs?: number;
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
  private static readonly ProjectConfigSchema = z.object({
    description: z.string().optional(),
    name: z.string().min(1),
    path: z.string().min(1),
    patterns: z.object({
      exclude: z.array(z.string()).optional(),
      include: z.array(z.string()).optional()
    }).optional(),
    url: z.string().optional()
  });
  private static readonly ServerConfigSchema = z.object({
    args: z.array(z.string()),
    capabilities: z.record(z.string(), z.unknown()).optional(),
    command: z.string().min(1),
    configuration: z.record(z.string(), z.unknown()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    extensions: z.array(z.string()).min(1),
    init: z.array(z.string()).optional(),
    projects: z.array(Config.ProjectConfigSchema).min(1),
    settings: z.object({
      loggingLevel: z.enum(['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency']).optional(),
      maxConcurrentFileReads: z.number().optional(),
      rateLimitMaxRequests: z.number().optional(),
      rateLimitWindowMs: z.number().optional(),
      shutdownGracePeriodMs: z.number().optional(),
      timeoutMs: z.number().optional(),
    }).optional()
  });
  private static readonly ConfigSchema = z.object({
    servers: z.record(z.string(), Config.ServerConfigSchema).refine(
      (servers) => Object.keys(servers).length > 0,
      { message: 'At least one language server configuration is required.' }
    )
  });

  /**
   * Creates a new Config instance with validated configuration
   * 
   * Private constructor ensures all instances are created through the static
   * factory method, guaranteeing proper validation before instantiation.
   * 
   * @private
   * @param {GlobalConfig} config - Pre-validated configuration object
   */
  private constructor(config: GlobalConfig) {
    this.config = config;
  }

  /**
   * Validates configuration from file
   * 
   * Reads JSON configuration file, validates structure and content using Zod schema,
   * and returns validated Config instance. Provides detailed error messages for
   * validation failures.
   * 
   * @static
   * @param {string} configPath - Absolute path to configuration JSON file
   * @returns {Config} Validated Config instance
   * @throws {Error} If file cannot be read or configuration is invalid
   */
  static validate(configPath: string): Config {
    try {
      const configData = readFileSync(configPath, 'utf-8');
      const parsedData = JSON.parse(configData);
      const validatedConfig = Config.ConfigSchema.parse(parsedData);
      return new Config(validatedConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((e: z.core.$ZodIssue) =>
          `${e.path.join('.')}: ${e.message}`
        ).join(', ');
        throw new Error(`Failed to load '${configPath}' configuration file: ${errors}`);
      }
      throw new Error(`Failed to load '${configPath}' configuration file: ${error}`);
    }
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
   *   env?: Record<string, string>,
   *   extensions: string[],
   *   init?: string[],
   *   projects: ProjectConfig[],
   *   settings: {
   *     loggingLevel?: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency',
   *     maxConcurrentFileReads: number,
   *     rateLimitMaxRequests: number,
   *     rateLimitWindowMs: number,
   *     shutdownGracePeriodMs: number,
   *     timeoutMs: number
   *   }
   * }} Complete server configuration with applied defaults
   */
  getServerConfig(languageId: string): {
    args: string[];
    capabilities?: Partial<ClientCapabilities>;
    command: string;
    configuration?: Record<string, unknown>;
    env?: Record<string, string>;
    extensions: string[];
    init?: string[];
    projects: ProjectConfig[];
    settings: {
      loggingLevel?: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
      maxConcurrentFileReads: number;
      rateLimitMaxRequests: number;
      rateLimitWindowMs: number;
      shutdownGracePeriodMs: number;
      timeoutMs: number;
    };
  } {
    const serverConfig = this.config.servers[languageId];
    if (!serverConfig) {
      return {
        args: [],
        command: '',
        configuration: undefined,
        env: undefined,
        extensions: [],
        projects: [],
        settings: {
          maxConcurrentFileReads: 10,
          rateLimitMaxRequests: 100,
          rateLimitWindowMs: 60000,
          shutdownGracePeriodMs: 100,
          timeoutMs: 600000
        }
      };
    }
    return {
      args: serverConfig.args,
      capabilities: serverConfig.capabilities,
      command: serverConfig.command,
      configuration: serverConfig.configuration,
      env: serverConfig.env,
      extensions: serverConfig.extensions,
      init: serverConfig.init,
      projects: serverConfig.projects,
      settings: {
        loggingLevel: serverConfig.settings?.loggingLevel,
        maxConcurrentFileReads: serverConfig.settings?.maxConcurrentFileReads ?? 10,
        rateLimitMaxRequests: serverConfig.settings?.rateLimitMaxRequests ?? 100,
        rateLimitWindowMs: serverConfig.settings?.rateLimitWindowMs ?? 60000,
        shutdownGracePeriodMs: serverConfig.settings?.shutdownGracePeriodMs ?? 100,
        timeoutMs: serverConfig.settings?.timeoutMs ?? 600000
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
