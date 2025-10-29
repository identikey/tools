# IdentiKey Tools - Deployment Guide

**Version:** 0.0.1  
**Date:** 2025-10-29  
**Audience:** DevOps, System Administrators, Deployment Engineers

## Overview

This guide covers production deployment of IdentiKey Tools encrypted storage system, including:

- MinIO storage backend setup (Docker, Kubernetes, AWS S3)
- Environment configuration and validation
- Monitoring, logging, and health checks
- Security hardening and best practices

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [MinIO Deployment](#minio-deployment)
   - [Docker Setup](#docker-setup)
   - [Kubernetes Deployment](#kubernetes-deployment)
   - [AWS S3 Alternative](#aws-s3-alternative)
3. [Environment Configuration](#environment-configuration)
4. [Security Considerations](#security-considerations)
5. [Monitoring & Logging](#monitoring--logging)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **Node.js/Bun:** Bun >= 1.0 or Node.js >= 18
- **Storage Backend:** MinIO >= RELEASE.2024-01-01 or AWS S3
- **Memory:** Minimum 512MB available (encryption operations)
- **Network:** Low-latency connection to storage backend (< 10ms RTT recommended)

### Dependencies

```bash
# Install via npm/yarn/bun
bun add @identikey/tools

# Peer dependencies (if using MinIO)
bun add minio
```

---

## MinIO Deployment

### Docker Setup

#### Quick Start (Development)

```bash
# Run MinIO container
docker run -d \
  --name identikey-minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e "MINIO_ROOT_USER=your-access-key" \
  -e "MINIO_ROOT_PASSWORD=your-secret-key" \
  -v /path/to/data:/data \
  minio/minio server /data --console-address ":9001"

# Access MinIO Console at http://localhost:9001
```

#### Production Docker Compose

```yaml
# docker-compose.yml
version: "3.8"

services:
  minio:
    image: minio/minio:latest
    container_name: identikey-minio
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
      # Enable TLS (provide cert files)
      # MINIO_OPTS: "--certs-dir /root/.minio/certs"
    volumes:
      - minio-data:/data
      # - ./certs:/root/.minio/certs  # TLS certificates
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  minio-data:
    driver: local
```

**Environment Variables (.env):**

```bash
MINIO_ROOT_USER=your-access-key-min-3-chars
MINIO_ROOT_PASSWORD=your-secret-key-min-8-chars
```

**Deployment:**

```bash
docker-compose up -d
```

### Kubernetes Deployment

#### Helm Chart (Recommended)

```bash
# Add MinIO Helm repository
helm repo add minio https://charts.min.io/
helm repo update

# Install MinIO
helm install identikey-minio minio/minio \
  --namespace identikey \
  --create-namespace \
  --set rootUser=your-access-key \
  --set rootPassword=your-secret-key \
  --set persistence.enabled=true \
  --set persistence.size=100Gi \
  --set persistence.storageClass=standard \
  --set replicas=4 \
  --set mode=distributed \
  --set resources.requests.memory=512Mi
```

#### Manual Kubernetes Manifest

```yaml
# minio-deployment.yaml
apiVersion: v1
kind: Service
metadata:
  name: identikey-minio
  namespace: identikey
spec:
  type: ClusterIP
  ports:
    - port: 9000
      targetPort: 9000
      protocol: TCP
      name: api
    - port: 9001
      targetPort: 9001
      protocol: TCP
      name: console
  selector:
    app: identikey-minio
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: identikey-minio
  namespace: identikey
spec:
  serviceName: identikey-minio
  replicas: 4
  selector:
    matchLabels:
      app: identikey-minio
  template:
    metadata:
      labels:
        app: identikey-minio
    spec:
      containers:
        - name: minio
          image: minio/minio:latest
          args:
            - server
            - /data
            - --console-address
            - ":9001"
          env:
            - name: MINIO_ROOT_USER
              valueFrom:
                secretKeyRef:
                  name: minio-credentials
                  key: rootUser
            - name: MINIO_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: minio-credentials
                  key: rootPassword
          ports:
            - containerPort: 9000
              name: api
            - containerPort: 9001
              name: console
          volumeMounts:
            - name: data
              mountPath: /data
          livenessProbe:
            httpGet:
              path: /minio/health/live
              port: 9000
            initialDelaySeconds: 30
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /minio/health/ready
              port: 9000
            initialDelaySeconds: 10
            periodSeconds: 10
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: standard
        resources:
          requests:
            storage: 100Gi
---
apiVersion: v1
kind: Secret
metadata:
  name: minio-credentials
  namespace: identikey
type: Opaque
stringData:
  rootUser: your-access-key
  rootPassword: your-secret-key
```

**Deploy:**

```bash
kubectl apply -f minio-deployment.yaml
```

### AWS S3 Alternative

IdentiKey Tools MinioAdapter is S3-compatible. To use AWS S3:

**Configuration:**

```typescript
import { MinioAdapter } from "@identikey/tools/storage/minio-adapter";

const adapter = new MinioAdapter({
  endpoint: "s3.amazonaws.com",
  port: 443,
  useSSL: true,
  accessKey: process.env.AWS_ACCESS_KEY_ID,
  secretKey: process.env.AWS_SECRET_ACCESS_KEY,
  bucket: "identikey-encrypted-storage",
  // For non-us-east-1 regions, use regional endpoint
  // endpoint: 's3.us-west-2.amazonaws.com'
});
```

**S3 Bucket Configuration:**

1. Create bucket via AWS Console or CLI
2. Enable versioning (recommended for recovery)
3. Configure bucket policy for application access
4. Enable server-side encryption (AES-256 or KMS)

**IAM Policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::identikey-encrypted-storage",
        "arn:aws:s3:::identikey-encrypted-storage/*"
      ]
    }
  ]
}
```

---

## Environment Configuration

### Required Environment Variables

```bash
# MinIO/S3 Connection
MINIO_ENDPOINT=localhost              # MinIO server hostname
MINIO_PORT=9000                       # MinIO API port
MINIO_ACCESS_KEY=your-access-key      # Access key (min 3 chars)
MINIO_SECRET_KEY=your-secret-key      # Secret key (min 8 chars)
MINIO_USE_SSL=false                   # Use HTTPS (true in production)
MINIO_BUCKET=identikey-storage        # Bucket name

# Optional: Application-level config
LOG_LEVEL=info                        # info, debug, warn, error
ENCRYPTION_LOG_FAILURES=true          # Log failed decryption attempts
```

### Environment Validation (AC11)

IdentiKey Tools validates environment configuration at runtime:

```typescript
import { MinioAdapter } from "@identikey/tools/storage/minio-adapter";
import { MinioConfig } from "@identikey/tools/types/storage-config";

function validateConfig(config: MinioConfig): void {
  // Endpoint validation
  if (!config.endpoint || config.endpoint.trim() === "") {
    throw new Error("MINIO_ENDPOINT is required and cannot be empty");
  }

  // Port validation
  if (
    !Number.isInteger(config.port) ||
    config.port < 1 ||
    config.port > 65535
  ) {
    throw new Error(
      `MINIO_PORT must be valid port number (1-65535), got: ${config.port}`
    );
  }

  // Credentials validation
  if (!config.accessKey || config.accessKey.length < 3) {
    throw new Error("MINIO_ACCESS_KEY must be at least 3 characters");
  }

  if (!config.secretKey || config.secretKey.length < 8) {
    throw new Error("MINIO_SECRET_KEY must be at least 8 characters");
  }

  // Bucket validation
  if (!config.bucket || !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(config.bucket)) {
    throw new Error(
      `Invalid bucket name: ${config.bucket}. Must be lowercase, start/end with alphanumeric, contain only [a-z0-9.-]`
    );
  }
}

// Use in application bootstrap
try {
  const config: MinioConfig = {
    endpoint: process.env.MINIO_ENDPOINT || "",
    port: parseInt(process.env.MINIO_PORT || "9000"),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY || "",
    secretKey: process.env.MINIO_SECRET_KEY || "",
    bucket: process.env.MINIO_BUCKET || "",
  };

  validateConfig(config);

  const adapter = new MinioAdapter(config);
  await adapter.ensureBucket(); // Validate connectivity

  console.log("✓ Storage backend configured successfully");
} catch (err) {
  console.error("✗ Configuration error:", err.message);
  process.exit(1);
}
```

**Validation Errors:**

- Missing/empty endpoint → `MINIO_ENDPOINT is required`
- Invalid port → `MINIO_PORT must be valid port number`
- Weak credentials → `MINIO_SECRET_KEY must be at least 8 characters`
- Invalid bucket name → `Invalid bucket name: ...`
- Connection failure → `MinIO bucket setup failed: ...`

---

## Security Considerations

### TLS/SSL Configuration

**Always use TLS in production:**

```bash
# Generate self-signed cert (dev only)
openssl req -new -newkey rsa:4096 -days 365 -nodes -x509 \
  -keyout private.key \
  -out public.crt

# MinIO TLS setup
mkdir -p ~/.minio/certs
cp public.crt ~/.minio/certs/public.crt
cp private.key ~/.minio/certs/private.key

# Restart MinIO with TLS enabled
MINIO_USE_SSL=true
```

**Let's Encrypt (Production):**

```bash
# Use certbot for automatic certificate management
certbot certonly --standalone -d minio.yourdomain.com
cp /etc/letsencrypt/live/minio.yourdomain.com/fullchain.pem ~/.minio/certs/public.crt
cp /etc/letsencrypt/live/minio.yourdomain.com/privkey.pem ~/.minio/certs/private.key
```

### Access Control

1. **Rotate credentials regularly** (90-day cycle recommended)
2. **Use IAM policies** for fine-grained access control
3. **Enable audit logging** in MinIO
4. **Restrict network access** (VPC, firewall rules)
5. **Use secrets manager** (AWS Secrets Manager, HashiCorp Vault)

### Encryption at Rest

**MinIO Server-Side Encryption:**

```bash
# KMS-based encryption
mc admin config set myminio encrypt_kms \
  kes_endpoint=https://kes-server:7373 \
  kes_key_name=my-key
```

**Note:** IdentiKey Tools already provides client-side encryption (TweetNaCl).  
Server-side encryption adds defense-in-depth.

---

## Monitoring & Logging

### Health Checks (AC12)

**Storage Backend Health:**

```typescript
async function checkStorageHealth(): Promise<boolean> {
  const testKey = `health-check-${Date.now()}`;
  const testData = Buffer.from("ping");

  try {
    await storage.put(testKey, testData);
    const retrieved = await storage.get(testKey);
    await storage.delete(testKey);
    return retrieved.equals(testData);
  } catch (err) {
    console.error("Storage health check failed:", err);
    return false;
  }
}

// Run health check every 60 seconds
setInterval(async () => {
  const healthy = await checkStorageHealth();
  if (!healthy) {
    // Alert ops team
    console.error("ALERT: Storage backend unhealthy");
  }
}, 60000);
```

**Metrics to Track:**

| Metric              | Description                | Alert Threshold            |
| ------------------- | -------------------------- | -------------------------- |
| Encryption latency  | Time to encrypt + upload   | > 1s (1MB file)            |
| Decryption latency  | Time to download + decrypt | > 500ms (1MB file)         |
| Failed decryptions  | Count of auth failures     | > 10/min (possible attack) |
| Storage capacity    | Disk usage                 | > 80% full                 |
| Request error rate  | Failed storage ops         | > 5% of requests           |
| Health check status | Backend availability       | 2 consecutive failures     |

### Logging Best Practices

**Structured Logging:**

```typescript
import { createHash } from "crypto";

function logEncryptionEvent(
  operation: "put" | "get",
  contentHash: string,
  success: boolean,
  latencyMs: number
) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      operation,
      contentHash: contentHash.substring(0, 16) + "...", // Partial hash for privacy
      success,
      latencyMs,
      level: success ? "info" : "error",
    })
  );
}

// Usage
const startTime = performance.now();
try {
  const hash = await storage.put(plaintext, publicKey);
  logEncryptionEvent("put", hash, true, performance.now() - startTime);
} catch (err) {
  logEncryptionEvent("put", "failed", false, performance.now() - startTime);
  throw err;
}
```

**Audit Trail:**

- Log all encryption/decryption operations (success/failure)
- Include content hash (partial) for correlation
- Record latency for performance monitoring
- Track failed authentication attempts (security)
- Exclude sensitive data (keys, plaintexts) from logs

**Log Aggregation:**

- Use centralized logging (ELK Stack, Splunk, DataDog)
- Set retention policy (90 days recommended)
- Enable alerting on anomalies (spike in failures)

---

## Troubleshooting

### Common Issues

#### Connection Refused

**Symptom:** `MinIO bucket setup failed: connect ECONNREFUSED`

**Solutions:**

1. Verify MinIO is running: `docker ps` or `kubectl get pods`
2. Check network connectivity: `curl http://localhost:9000/minio/health/live`
3. Validate firewall rules allow port 9000
4. Ensure correct endpoint in configuration

#### Authentication Failed

**Symptom:** `Access Denied` or `Invalid access key ID`

**Solutions:**

1. Verify credentials match MinIO configuration
2. Check for trailing whitespace in env vars: `echo "$MINIO_ACCESS_KEY" | xxd`
3. Rotate credentials if compromised
4. Review IAM policies (S3) or bucket policies (MinIO)

#### Bucket Does Not Exist

**Symptom:** `The specified bucket does not exist`

**Solutions:**

1. Call `adapter.ensureBucket()` at startup
2. Manually create bucket via MinIO Console or `mc mb`
3. Check bucket name matches configuration
4. Verify application has permissions to create buckets

#### Slow Performance

**Symptom:** Latency > 500ms for 1MB files

**Solutions:**

1. Check network latency: `ping minio-endpoint`
2. Verify storage backend isn't saturated (IOPS, bandwidth)
3. Profile encryption overhead (see benchmarks)
4. Consider connection pooling or parallel uploads
5. Use regional endpoints (AWS S3) to minimize latency

#### Decryption Failures

**Symptom:** `Decryption failed: invalid key or corrupted ciphertext`

**Solutions:**

1. Verify correct private key for recipient public key
2. Check if blob was tampered with (content hash mismatch)
3. Ensure KeyManager contains required private key
4. Review audit logs for corruption patterns
5. Validate TweetNaCl version matches encryption version

---

## Production Checklist

- [ ] **TLS/SSL enabled** for MinIO/S3 endpoints
- [ ] **Credentials rotated** and stored in secrets manager
- [ ] **Environment validation** runs at application startup
- [ ] **Health checks** configured with alerting
- [ ] **Monitoring dashboards** created for key metrics
- [ ] **Audit logging** enabled and centralized
- [ ] **Backup strategy** defined for MinIO data
- [ ] **Disaster recovery** plan documented
- [ ] **Load testing** completed with expected traffic
- [ ] **Security review** passed (penetration testing)
- [ ] **Documentation** reviewed and up-to-date

---

## Support & Resources

- **GitHub Issues:** https://github.com/identikey/tools/issues
- **Documentation:** https://docs.identikey.io
- **Security:** security@identikey.io (report vulnerabilities)
- **MinIO Docs:** https://min.io/docs/
- **AWS S3 Docs:** https://docs.aws.amazon.com/s3/

---

**Last Updated:** 2025-10-29  
**Document Version:** 1.0  
**Author:** Amelia (Dev Agent)
