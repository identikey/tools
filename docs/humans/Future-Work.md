
Backlog

We need to define the error paths in our encryption, decryption, and file storage. We need to define the multi-backend file storage architecture, including local file system and S3 compatible.

The serialization format rather than having fingerprint be base 58 and then the rest of the five. file is binary we should have a binary CBOR format but have a ASCII armored serialization. Pull this from the Recrypt library
