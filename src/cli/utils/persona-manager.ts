import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import { tmpdir } from 'os';

/**
 * Persona configuration structure
 */
export interface PersonaConfig {
  name: string;
  keyPath: string;
  publicKeyPath: string;
  createdAt: string;
  fingerprint: string;
}

/**
 * Configuration file structure
 */
export interface Config {
  activePersona: string;
  personas: Record<string, PersonaConfig>;
}

/**
 * Manages persona configurations and key storage
 * Similar to AWS CLI profiles or Solana CLI keypairs
 */
export class PersonaManager {
  private configPath: string;
  private personasDir: string;

  constructor(configDir?: string) {
    // Use ~/.config/identikey on Unix, %APPDATA%/identikey on Windows
    const baseDir = configDir || this.getDefaultConfigDir();
    this.configPath = join(baseDir, 'config.json');
    this.personasDir = join(baseDir, 'personas');

    // Ensure directories exist
    this.ensureConfigDir();
  }

  /**
   * Get default config directory based on platform
   */
  private getDefaultConfigDir(): string {
    if (platform() === 'win32') {
      return join(process.env.APPDATA || homedir(), 'identikey');
    }
    return join(homedir(), '.config', 'identikey');
  }

  /**
   * Ensure config directory structure exists
   */
  private ensureConfigDir(): void {
    const configDir = this.configPath.substring(0, this.configPath.lastIndexOf('/'));
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    if (!existsSync(this.personasDir)) {
      mkdirSync(this.personasDir, { recursive: true });
    }
  }

  /**
   * Load configuration from disk, or return empty config if not exists
   */
  private loadConfig(): Config {
    if (!existsSync(this.configPath)) {
      return {
        activePersona: '',
        personas: {},
      };
    }

    try {
      const data = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to load config from ${this.configPath}: ${error}`);
    }
  }

  /**
   * Save configuration to disk atomically (write to temp, then rename)
   */
  private saveConfig(config: Config): void {
    // Atomic write: write to temp file, then rename
    const tempPath = join(tmpdir(), `identikey-config-${Date.now()}.json`);
    
    try {
      writeFileSync(tempPath, JSON.stringify(config, null, 2), 'utf-8');
      writeFileSync(this.configPath, readFileSync(tempPath, 'utf-8'), 'utf-8');
      
      // Clean up temp file (best effort)
      try {
        const fs = require('fs');
        fs.unlinkSync(tempPath);
      } catch {}
    } catch (error) {
      throw new Error(`Failed to save config to ${this.configPath}: ${error}`);
    }
  }

  /**
   * List all personas
   */
  listPersonas(): PersonaConfig[] {
    const config = this.loadConfig();
    return Object.values(config.personas);
  }

  /**
   * Get active persona configuration
   */
  getActivePersona(): PersonaConfig | null {
    const config = this.loadConfig();
    
    if (!config.activePersona) {
      return null;
    }

    const persona = config.personas[config.activePersona];
    return persona || null;
  }

  /**
   * Set active persona
   */
  setActivePersona(name: string): void {
    const config = this.loadConfig();

    if (!config.personas[name]) {
      throw new Error(`Persona '${name}' not found. Available personas: ${Object.keys(config.personas).join(', ')}`);
    }

    config.activePersona = name;
    this.saveConfig(config);
  }

  /**
   * Create a new persona entry in config
   */
  createPersona(name: string, keyPath: string, fingerprint: string): void {
    const config = this.loadConfig();

    if (config.personas[name]) {
      throw new Error(`Persona '${name}' already exists`);
    }

    const persona: PersonaConfig = {
      name,
      keyPath,
      publicKeyPath: keyPath, // Same file contains both keys
      createdAt: new Date().toISOString(),
      fingerprint,
    };

    config.personas[name] = persona;

    // If this is the first persona, make it active
    if (Object.keys(config.personas).length === 1) {
      config.activePersona = name;
    }

    this.saveConfig(config);
  }

  /**
   * Delete a persona
   */
  deletePersona(name: string): void {
    const config = this.loadConfig();

    if (!config.personas[name]) {
      throw new Error(`Persona '${name}' not found`);
    }

    delete config.personas[name];

    // If deleted persona was active, clear active or set to first available
    if (config.activePersona === name) {
      const remaining = Object.keys(config.personas);
      config.activePersona = remaining.length > 0 ? remaining[0] : '';
    }

    this.saveConfig(config);
  }

  /**
   * Get key path for a persona (or active persona if not specified)
   */
  getPersonaKeyPath(name?: string): string {
    const config = this.loadConfig();
    const personaName = name || config.activePersona || '';

    if (!personaName) {
      throw new Error('No persona specified and no active persona set. Run "identikey keygen" first.');
    }

    const persona = config.personas[personaName];
    if (!persona) {
      throw new Error(`Persona '${personaName}' not found`);
    }

    return persona.keyPath;
  }

  /**
   * Get default persona directory path
   */
  getPersonaDir(name: string): string {
    return join(this.personasDir, name);
  }

  /**
   * Get default key file path for a persona
   */
  getDefaultKeyPath(name: string): string {
    return join(this.getPersonaDir(name), 'id.json');
  }
}

