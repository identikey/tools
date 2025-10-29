import { promises as fs } from "fs";
import * as path from "path";
import type { StorageAdapter } from "./adapter.js";

export interface FilesystemConfig {
  rootDir: string; // Root directory for blob storage
}

/**
 * Filesystem storage adapter for integration tests and local development.
 * Stores blobs as files in a local directory.
 *
 * Features:
 * - Atomic writes (temp file + fsync + rename)
 * - Path traversal protection
 * - Cross-platform compatible
 * - Streaming support (future enhancement)
 *
 * Use for:
 * - Integration tests (offline, but touches OS)
 * - Local development without MinIO
 * - Testing filesystem-specific behavior
 *
 * Security:
 * - Keys are sanitized to prevent directory traversal
 * - All paths must stay within rootDir
 */
export class FilesystemAdapter implements StorageAdapter {
  private rootDir: string;

  constructor(config: FilesystemConfig) {
    this.rootDir = path.resolve(config.rootDir);
  }

  /**
   * Ensure root directory exists.
   */
  async ensureRoot(): Promise<void> {
    await fs.mkdir(this.rootDir, { recursive: true, mode: 0o700 });
  }

  async put(key: string, data: Buffer): Promise<void> {
    const filePath = this.getSecurePath(key);

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });

    // Atomic write: temp file -> fsync -> rename
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random()
      .toString(36)
      .slice(2)}`;

    try {
      // Write to temp file
      await fs.writeFile(tempPath, data, { mode: 0o600 });

      // Fsync the file (flush to disk)
      const fd = await fs.open(tempPath, "r+");
      try {
        await fd.sync();
      } finally {
        await fd.close();
      }

      // Atomic rename (POSIX guarantees atomicity)
      await fs.rename(tempPath, filePath);

      // Fsync parent directory (ensures rename is durable on Linux)
      try {
        const dirFd = await fs.open(path.dirname(filePath), "r");
        try {
          await dirFd.sync();
        } finally {
          await dirFd.close();
        }
      } catch (err) {
        // Directory fsync not supported on all platforms (Windows)
        // Non-fatal, continue
      }
    } catch (err) {
      // Cleanup temp file on failure
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw new Error(
        `Filesystem put failed for key "${key}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  async get(key: string): Promise<Buffer> {
    const filePath = this.getSecurePath(key);

    try {
      return await fs.readFile(filePath);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        throw new Error(`Blob not found: ${key}`);
      }
      throw new Error(
        `Filesystem get failed for key "${key}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.getSecurePath(key);

    try {
      await fs.access(filePath);
      return true;
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return false;
      }
      // Other errors (permissions, etc.) should propagate
      throw new Error(
        `Filesystem exists check failed for key "${key}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getSecurePath(key);

    try {
      await fs.unlink(filePath);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        // Already deleted, no-op (idempotent)
        return;
      }
      throw new Error(
        `Filesystem delete failed for key "${key}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  /**
   * Clear all blobs in storage (useful for test cleanup).
   * WARNING: Deletes entire rootDir!
   */
  async clear(): Promise<void> {
    try {
      await fs.rm(this.rootDir, { recursive: true, force: true });
    } catch (err) {
      throw new Error(
        `Filesystem clear failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  /**
   * Get secure file path from key, preventing directory traversal.
   *
   * Security measures:
   * - Reject absolute paths
   * - Reject parent directory references (..)
   * - Reject empty keys
   * - Ensure resolved path stays within rootDir
   */
  private getSecurePath(key: string): string {
    if (!key || key.trim() === "") {
      throw new Error("Key cannot be empty");
    }

    // Reject absolute paths
    if (path.isAbsolute(key)) {
      throw new Error(`Key cannot be absolute path: ${key}`);
    }

    // Reject parent directory references
    if (key.includes("..")) {
      throw new Error(`Key cannot contain '..': ${key}`);
    }

    // Normalize and resolve path
    const normalized = path.normalize(key);
    const fullPath = path.resolve(this.rootDir, normalized);

    // Ensure path stays within rootDir (defense in depth)
    if (
      !fullPath.startsWith(this.rootDir + path.sep) &&
      fullPath !== this.rootDir
    ) {
      throw new Error(`Key resolves outside root directory: ${key}`);
    }

    return fullPath;
  }
}
