
Backlog

We need to define the error paths in our encryption, decryption, and file storage. We need to define the multi-backend file storage architecture, including local file system and S3 compatible.

The serialization format rather than having fingerprint be base 58 and then the rest of the five. file is binary we should have a binary CBOR format but have a ASCII armored serialization. Pull this from the Recrypt library

"MinioAdapter - S3-compatible implementation with stream-to-buffer conversion"
Make sure to include a protocol interface specification for a streaming version of the adapters, the storage adapters. So ideally we should have both the async and synchronous versions where you can trigger the stream to buffer, or you can receive the stream directly and parse it. Possibly include ch Chunking, sort of like LLM token chunking. 