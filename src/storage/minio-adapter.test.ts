import { describe, it, expect, mock, beforeEach } from "bun:test";
import { MinioAdapter } from "./minio-adapter.js";
import type { MinioConfig } from "../types/storage-config.js";
import type * as Minio from "minio";

/**
 * Unit tests for MinioAdapter with mocked MinIO client.
 * Tests adapter logic without real MinIO infrastructure.
 */

// Mock MinIO client
const createMockClient = () => {
  return {
    putObject: mock(async () => {}),
    getObject: mock(async () => mockStream()),
    statObject: mock(async () => ({ size: 1024 })),
    removeObject: mock(async () => {}),
    bucketExists: mock(async () => true),
    makeBucket: mock(async () => {}),
  } as unknown as Minio.Client;
};

// Mock readable stream
const mockStream = () => {
  const chunks = [Buffer.from("test"), Buffer.from("data")];
  return {
    on: (event: string, handler: Function) => {
      if (event === "data") {
        chunks.forEach(handler);
      } else if (event === "end") {
        setTimeout(() => handler(), 0);
      }
      return mockStream();
    },
  };
};

describe("MinioAdapter", () => {
  let config: MinioConfig;
  let mockClient: Minio.Client;

  beforeEach(() => {
    config = {
      endpoint: "localhost",
      port: 9000,
      useSSL: false,
      accessKey: "minioadmin",
      secretKey: "minioadmin",
      bucket: "test-bucket",
    };
    mockClient = createMockClient();
  });

  describe("put", () => {
    it("stores blob at key via MinIO client (AC#3)", async () => {
      const adapter = new MinioAdapter(config);
      (adapter as any).client = mockClient;

      const data = Buffer.from("test data");
      await adapter.put("content-hash", data);

      expect(mockClient.putObject).toHaveBeenCalledWith(
        "test-bucket",
        "content-hash",
        data,
        data.length
      );
    });

    it("wraps MinIO put errors with context", async () => {
      const adapter = new MinioAdapter(config);
      mockClient.putObject = mock(async () => {
        throw new Error("Network timeout");
      });
      (adapter as any).client = mockClient;

      const data = Buffer.from("test");

      await expect(adapter.put("key", data)).rejects.toThrow(
        /MinIO put failed.*key/
      );
    });
  });

  describe("get", () => {
    it("retrieves blob and converts stream to Buffer (AC#4)", async () => {
      const adapter = new MinioAdapter(config);
      (adapter as any).client = mockClient;

      const result = await adapter.get("content-hash");

      expect(mockClient.getObject).toHaveBeenCalledWith(
        "test-bucket",
        "content-hash"
      );
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe("testdata");
    });

    it("wraps MinIO get errors with context", async () => {
      const adapter = new MinioAdapter(config);
      mockClient.getObject = mock(async () => {
        throw new Error("Object not found");
      });
      (adapter as any).client = mockClient;

      await expect(adapter.get("missing-key")).rejects.toThrow(
        /MinIO get failed.*missing-key/
      );
    });
  });

  describe("exists", () => {
    it("returns true when object exists (AC#5)", async () => {
      const adapter = new MinioAdapter(config);
      (adapter as any).client = mockClient;

      const result = await adapter.exists("existing-key");

      expect(mockClient.statObject).toHaveBeenCalledWith(
        "test-bucket",
        "existing-key"
      );
      expect(result).toBe(true);
    });

    it("returns false when object not found (404)", async () => {
      const adapter = new MinioAdapter(config);
      const notFoundError: any = new Error("Not found");
      notFoundError.code = "NotFound";
      mockClient.statObject = mock(async () => {
        throw notFoundError;
      });
      (adapter as any).client = mockClient;

      const result = await adapter.exists("missing-key");

      expect(result).toBe(false);
    });

    it("returns false when 404 status code", async () => {
      const adapter = new MinioAdapter(config);
      const notFoundError: any = new Error("Not found");
      notFoundError.statusCode = 404;
      mockClient.statObject = mock(async () => {
        throw notFoundError;
      });
      (adapter as any).client = mockClient;

      const result = await adapter.exists("missing-key");

      expect(result).toBe(false);
    });

    it("throws on non-404 errors", async () => {
      const adapter = new MinioAdapter(config);
      mockClient.statObject = mock(async () => {
        throw new Error("Network error");
      });
      (adapter as any).client = mockClient;

      await expect(adapter.exists("key")).rejects.toThrow(
        /MinIO exists check failed/
      );
    });
  });

  describe("delete", () => {
    it("removes object from MinIO (AC#6)", async () => {
      const adapter = new MinioAdapter(config);
      (adapter as any).client = mockClient;

      await adapter.delete("key-to-delete");

      expect(mockClient.removeObject).toHaveBeenCalledWith(
        "test-bucket",
        "key-to-delete"
      );
    });

    it("wraps MinIO delete errors with context", async () => {
      const adapter = new MinioAdapter(config);
      mockClient.removeObject = mock(async () => {
        throw new Error("Permission denied");
      });
      (adapter as any).client = mockClient;

      await expect(adapter.delete("key")).rejects.toThrow(
        /MinIO delete failed.*key/
      );
    });
  });

  describe("ensureBucket", () => {
    it("creates bucket if it doesn't exist", async () => {
      const adapter = new MinioAdapter(config);
      mockClient.bucketExists = mock(async () => false);
      (adapter as any).client = mockClient;

      await adapter.ensureBucket();

      expect(mockClient.makeBucket).toHaveBeenCalledWith(
        "test-bucket",
        "us-east-1"
      );
    });

    it("skips bucket creation if bucket exists", async () => {
      const adapter = new MinioAdapter(config);
      mockClient.bucketExists = mock(async () => true);
      (adapter as any).client = mockClient;

      await adapter.ensureBucket();

      expect(mockClient.makeBucket).not.toHaveBeenCalled();
    });

    it("wraps bucket setup errors with context", async () => {
      const adapter = new MinioAdapter(config);
      mockClient.bucketExists = mock(async () => {
        throw new Error("Connection refused");
      });
      (adapter as any).client = mockClient;

      await expect(adapter.ensureBucket()).rejects.toThrow(
        /MinIO bucket setup failed/
      );
    });
  });

  describe("configuration", () => {
    it("initializes MinIO client with config", () => {
      const adapter = new MinioAdapter(config);

      // Adapter should store config values
      expect((adapter as any).bucket).toBe("test-bucket");
      expect((adapter as any).client).toBeDefined();
    });

    it("handles SSL configuration", () => {
      const sslConfig: MinioConfig = {
        ...config,
        useSSL: true,
      };

      const adapter = new MinioAdapter(sslConfig);

      expect((adapter as any).client).toBeDefined();
    });
  });
});

