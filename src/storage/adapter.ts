/**
 * Abstract storage adapter interface for pluggable backends.
 *
 * All operations are asynchronous and throw on errors.
 * Implementations: MinioAdapter, S3Adapter, FilesystemAdapter
 */
export interface StorageAdapter {
  /**
   * Store data at the given key.
   * @param key - Content hash or identifier
   * @param data - Binary blob to store
   * @throws Error if storage operation fails
   */
  put(key: string, data: Buffer): Promise<void>;

  /**
   * Retrieve data by key.
   * @param key - Content hash or identifier
   * @returns Binary blob
   * @throws Error if key doesn't exist or retrieval fails
   */
  get(key: string): Promise<Buffer>;

  /**
   * Check if key exists in storage.
   * @param key - Content hash or identifier
   * @returns true if exists, false otherwise
   */
  exists(key: string): Promise<boolean>;

  /**
   * Delete data by key.
   * @param key - Content hash or identifier
   * @throws Error if deletion fails (404 is not an error)
   */
  delete(key: string): Promise<void>;
}
