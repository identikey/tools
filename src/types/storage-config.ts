/**
 * MinIO storage backend configuration.
 */
export interface MinioConfig {
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

/**
 * General storage configuration (extensible for other backends).
 */
export interface StorageConfig {
  backend: "minio" | "s3" | "filesystem";
  minio?: MinioConfig;
  // Future: s3?: S3Config, filesystem?: FilesystemConfig
}
