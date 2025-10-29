import type { StorageAdapter } from "./adapter.js";

/**
 * In-memory storage adapter for unit tests.
 * Fast, deterministic, no I/O. Data cleared when process exits.
 *
 * Use for:
 * - Pure unit tests (crypto, key management, logic)
 * - CI/CD where speed matters
 * - Testing error paths with optional fault injection
 */
export class MemoryAdapter implements StorageAdapter {
  private store: Map<string, Buffer> = new Map();

  async put(key: string, data: Buffer): Promise<void> {
    // Store a copy to prevent external mutations
    this.store.set(key, Buffer.from(data));
  }

  async get(key: string): Promise<Buffer> {
    const data = this.store.get(key);
    if (!data) {
      throw new Error(`Blob not found: ${key}`);
    }
    // Return a copy to prevent external mutations
    return Buffer.from(data);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Clear all stored blobs (useful for test cleanup).
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get number of stored blobs (useful for test assertions).
   */
  size(): number {
    return this.store.size;
  }
}
