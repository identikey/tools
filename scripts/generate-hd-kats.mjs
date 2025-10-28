import crypto from "node:crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";

function hmacSha512(key, data) {
  return crypto.createHmac("sha512", key).update(data).digest();
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest();
}

function hkdfSha512(ikm, salt, info, length) {
  const prk = crypto.createHmac("sha512", salt).update(ikm).digest();
  let t = Buffer.alloc(0);
  let okm = Buffer.alloc(0);
  let block = 1;
  while (okm.length < length) {
    t = crypto.createHmac("sha512", prk)
      .update(Buffer.concat([t, info, Buffer.from([block])]))
      .digest();
    okm = Buffer.concat([okm, t]);
    block += 1;
  }
  return okm.subarray(0, length);
}

function clampEd(seed32) {
  // For Ed25519 seeds, clamping is applied after hashing in Ed spec; here we rely on NaCl.fromSeed
  return seed32;
}

function deriveEdMaster(seed) {
  const I = hmacSha512(Buffer.from("ed25519 seed", "utf8"), seed);
  const k = I.subarray(0, 32);
  const c = I.subarray(32);
  return { k, c };
}

function ser32(i) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(i >>> 0, 0);
  return b;
}

function deriveEdChildHardened(parent, index) {
  const hardenedIndex = (index >>> 0) | 0x80000000;
  const data = Buffer.concat([Buffer.from([0x00]), parent.k, ser32(hardenedIndex)]);
  const I = hmacSha512(parent.c, data);
  const k = I.subarray(0, 32);
  const c = I.subarray(32);
  return { k, c };
}

function edKeypairFromSeed32(seed32) {
  const kp = nacl.sign.keyPair.fromSeed(new Uint8Array(seed32));
  return { sk: Buffer.from(kp.secretKey.subarray(0, 32)), pk: Buffer.from(kp.publicKey) };
}

function clampX(sk) {
  const s = Buffer.from(sk);
  s[0] &= 248;
  s[31] &= 127;
  s[31] |= 64;
  return s;
}

function deriveX(path, seed) {
  const salt = sha256(Buffer.from("ik:x25519:root", "utf8"));
  const info = Buffer.from(path, "utf8");
  const skRaw = hkdfSha512(seed, salt, info, 32);
  const sk = clampX(skRaw);
  const pk = Buffer.from(nacl.scalarMult.base(new Uint8Array(sk)));
  return { sk, pk };
}

function fpHex(pk) {
  return sha256(pk).toString("hex");
}

function fpShort(pk, prefix) {
  const full = sha256(pk);
  const short = bs58.encode(full.subarray(0, 10));
  return `${prefix}-${short}`;
}

function hex(buf) { return Buffer.from(buf).toString("hex"); }

// Deterministic seed for vectors (32 bytes)
const seed = Buffer.from(Array.from({length:32}, (_,i)=>i)); // 00..1f

// Ed25519 path: ik:v1:ed25519/0/sign/0
const edMaster = deriveEdMaster(seed);
const edChild0 = deriveEdChildHardened(edMaster, 0);
const edKp = edKeypairFromSeed32(edChild0.k);
const edFp = fpHex(edKp.pk);
const edShort = fpShort(edKp.pk, "ed1");

// X25519 path: ik:v1:x25519/0/enc/0
const xPath = "ik:v1:x25519/0/enc/0";
const xKp = deriveX(xPath, seed);
const xFp = fpHex(xKp.pk);
const xShort = fpShort(xKp.pk, "x1");

const out = {
  seed_hex: hex(seed),
  ed: {
    path: "ik:v1:ed25519/0/sign/0",
    sk_hex: hex(edKp.sk),
    pk_hex: hex(edKp.pk),
    fingerprint_hex: edFp,
    fingerprint_short: edShort,
  },
  x: {
    path: xPath,
    sk_hex: hex(xKp.sk),
    pk_hex: hex(xKp.pk),
    fingerprint_hex: xFp,
    fingerprint_short: xShort,
  }
};

console.log(JSON.stringify(out, null, 2));
