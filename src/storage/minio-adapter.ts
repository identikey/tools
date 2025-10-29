import * as Minio from "minio";
import type { StorageAdapter } from "./adapter.js";
import type { MinioConfig } from "../types/storage-config.js";

/**
 * MinIO storage adapter implementing S3-compatible object storage.
 */
export class MinioAdapter implements StorageAdapter {
  private client: Minio.Client;
  private bucket: string;

  constructor(config: MinioConfig) {
    this.client = new Minio.Client({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
    this.bucket = config.bucket;
  }

  async put(key: string, data: Buffer): Promise<void> {
    try {
      await this.client.putObject(this.bucket, key, data, data.length);
    } catch (err) {
      throw new Error(
        `MinIO put failed for key "${key}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  async get(key: string): Promise<Buffer> {
    try {
      const stream = await this.client.getObject(this.bucket, key);
      return await streamToBuffer(stream);
    } catch (err) {
      throw new Error(
        `MinIO get failed for key "${key}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch (err: any) {
      if (err.code === "NotFound" || err.statusCode === 404) {
        return false;
      }
      throw new Error(
        `MinIO exists check failed for key "${key}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, key);
    } catch (err) {
      throw new Error(
        `MinIO delete failed for key "${key}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  /**
   * Ensure bucket exists, creating it if necessary (for tests/setup).
   */
  async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, "us-east-1");
      }
    } catch (err) {
      throw new Error(
        `MinIO bucket setup failed for "${this.bucket}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
}

/**
 * Convert readable stream to Buffer.
 */
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}
