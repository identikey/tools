import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { PersonaManager } from './persona-manager';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('PersonaManager', () => {
  let tempDir: string;
  let manager: PersonaManager;

  beforeEach(() => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `identikey-test-${Date.now()}-${Math.random()}`);
    mkdirSync(tempDir, { recursive: true });
    manager = new PersonaManager(tempDir);
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Configuration Management', () => {
    test('should initialize with empty config', () => {
      const personas = manager.listPersonas();
      expect(personas).toEqual([]);
    });

    test('should create new persona', () => {
      manager.createPersona('test', '/path/to/key.json', 'abc123');
      
      const personas = manager.listPersonas();
      expect(personas).toHaveLength(1);
      expect(personas[0].name).toBe('test');
      expect(personas[0].keyPath).toBe('/path/to/key.json');
      expect(personas[0].fingerprint).toBe('abc123');
    });

    test('should set first persona as active automatically', () => {
      manager.createPersona('first', '/path/key1.json', 'fp1');
      
      const active = manager.getActivePersona();
      expect(active).not.toBeNull();
      expect(active?.name).toBe('first');
    });

    test('should not set second persona as active', () => {
      manager.createPersona('first', '/path/key1.json', 'fp1');
      manager.createPersona('second', '/path/key2.json', 'fp2');
      
      const active = manager.getActivePersona();
      expect(active?.name).toBe('first');
    });

    test('should prevent duplicate persona names', () => {
      manager.createPersona('test', '/path/key1.json', 'fp1');
      
      expect(() => {
        manager.createPersona('test', '/path/key2.json', 'fp2');
      }).toThrow("Persona 'test' already exists");
    });
  });

  describe('Persona Switching', () => {
    beforeEach(() => {
      manager.createPersona('work', '/path/work.json', 'work-fp');
      manager.createPersona('personal', '/path/personal.json', 'personal-fp');
    });

    test('should switch active persona', () => {
      manager.setActivePersona('personal');
      
      const active = manager.getActivePersona();
      expect(active?.name).toBe('personal');
    });

    test('should fail to switch to non-existent persona', () => {
      expect(() => {
        manager.setActivePersona('nonexistent');
      }).toThrow("Persona 'nonexistent' not found");
    });
  });

  describe('Persona Deletion', () => {
    beforeEach(() => {
      manager.createPersona('keep', '/path/keep.json', 'keep-fp');
      manager.createPersona('delete', '/path/delete.json', 'delete-fp');
    });

    test('should delete persona', () => {
      manager.deletePersona('delete');
      
      const personas = manager.listPersonas();
      expect(personas).toHaveLength(1);
      expect(personas[0].name).toBe('keep');
    });

    test('should switch active if deleted persona was active', () => {
      manager.setActivePersona('delete');
      manager.deletePersona('delete');
      
      const active = manager.getActivePersona();
      expect(active?.name).toBe('keep');
    });

    test('should clear active if last persona deleted', () => {
      manager.deletePersona('keep');
      manager.deletePersona('delete');
      
      const active = manager.getActivePersona();
      expect(active).toBeNull();
    });

    test('should fail to delete non-existent persona', () => {
      expect(() => {
        manager.deletePersona('nonexistent');
      }).toThrow("Persona 'nonexistent' not found");
    });
  });

  describe('Key Path Resolution', () => {
    beforeEach(() => {
      manager.createPersona('test', '/path/test.json', 'test-fp');
    });

    test('should get key path for active persona', () => {
      const path = manager.getPersonaKeyPath();
      expect(path).toBe('/path/test.json');
    });

    test('should get key path for specific persona', () => {
      manager.createPersona('other', '/path/other.json', 'other-fp');
      const path = manager.getPersonaKeyPath('other');
      expect(path).toBe('/path/other.json');
    });

    test('should fail if no active persona', () => {
      const emptyManager = new PersonaManager(join(tempDir, 'empty'));
      
      expect(() => {
        emptyManager.getPersonaKeyPath();
      }).toThrow('No persona specified and no active persona set');
    });

    test('should fail for non-existent persona', () => {
      expect(() => {
        manager.getPersonaKeyPath('nonexistent');
      }).toThrow("Persona 'nonexistent' not found");
    });
  });

  describe('Config Persistence', () => {
    test('should persist config across instances', () => {
      manager.createPersona('persist', '/path/persist.json', 'persist-fp');
      
      // Create new manager instance with same config dir
      const newManager = new PersonaManager(tempDir);
      const personas = newManager.listPersonas();
      
      expect(personas).toHaveLength(1);
      expect(personas[0].name).toBe('persist');
    });

    test('should write valid JSON config file', () => {
      manager.createPersona('test', '/path/test.json', 'test-fp');
      
      const configPath = join(tempDir, 'config.json');
      expect(existsSync(configPath)).toBe(true);
      
      const configData = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      expect(config).toHaveProperty('activePersona');
      expect(config).toHaveProperty('personas');
      expect(config.personas.test).toBeDefined();
    });
  });

  describe('Default Paths', () => {
    test('should generate correct persona directory', () => {
      const dir = manager.getPersonaDir('test');
      expect(dir).toContain('personas/test');
    });

    test('should generate correct default key path', () => {
      const path = manager.getDefaultKeyPath('test');
      expect(path).toContain('personas/test/id.json');
    });
  });
});

