import crypto from "node:crypto";
import fs from "fs";
import pkgJson from "../package.json" with { type: "json" };
import type { FixedBigIntStats } from "./types/index.js";
import { promisify } from "node:util";

const VERSION = pkgJson.version.split(".").slice(0, 2).join(".");

export const SUPPORTED_ALGORITHMS = {
  "AES-256-GCM": {
    id: 1,
    name: "aes-256-gcm",
    ivLength: 12,
    tagLength: 16,
    keyLength: 32,
    isGCM: true,
  },
  "AES-256-CBC": {
    id: 2,
    name: "aes-256-cbc",
    ivLength: 16,
    tagLength: 0,
    keyLength: 32,
    isGCM: false,
  },
  "AES-256-CTR": {
    id: 3,
    name: "aes-256-ctr",
    ivLength: 16,
    tagLength: 0,
    keyLength: 32,
    isGCM: false,
  },
  "AES-128-GCM": {
    id: 4,
    name: "aes-128-gcm",
    ivLength: 12,
    tagLength: 16,
    keyLength: 16,
    isGCM: true,
  },
  "AES-128-CBC": {
    id: 5,
    name: "aes-128-cbc",
    ivLength: 16,
    tagLength: 0,
    keyLength: 16,
    isGCM: false,
  },
  "CHACHA20-POLY1305": {
    id: 6,
    name: "chacha20-poly1305",
    ivLength: 12,
    tagLength: 16,
    keyLength: 32,
    isGCM: true,
  },
} as const;

export const ALGORITHM_ID_MAP = Object.fromEntries(
  Object.values(SUPPORTED_ALGORITHMS).map((algo) => [algo.id, algo]),
);
export function buildHeader(
  algorithmId: number,
  salt: Buffer,
  iv: Buffer,
  meta: Buffer,
  magic: Buffer,
  authTagLength: number,
): Buffer {
  const versionBuf = Buffer.from(VERSION, "utf8");

  const metaLengthBuf = Buffer.allocUnsafe(4);
  metaLengthBuf.writeUInt32BE(meta.length, 0);

  return Buffer.concat([
    magic,
    Buffer.from([algorithmId]),
    Buffer.from([versionBuf.length]),
    Buffer.from([salt.length]),
    Buffer.from([iv.length]),
    metaLengthBuf,

    versionBuf,
    salt,
    iv,
    meta,

    Buffer.alloc(authTagLength),
  ]);
}

export interface ParsedHeader {
  salt: Buffer;
  iv: Buffer;
  meta: Buffer;
  authTag: Buffer;
  headerLength: number;
  algorithmId: number;
  version: string;
}

export function parseHeader(
  buf: Buffer,
  magicLength: number,
  expectedTagLength: number,
): ParsedHeader {
  let offset = magicLength;

  const algorithmId = buf.readUInt8(offset);
  offset += 1;

  const versionLength = buf.readUInt8(offset);
  offset += 1;

  const saltLength = buf.readUInt8(offset);
  offset += 1;

  const ivLength = buf.readUInt8(offset);
  offset += 1;

  const metaLength = buf.readUInt32BE(offset);
  offset += 4;

  const version = buf.subarray(offset, offset + versionLength);
  offset += versionLength;

  const salt = buf.subarray(offset, offset + saltLength);
  offset += saltLength;

  const iv = buf.subarray(offset, offset + ivLength);
  offset += ivLength;

  const meta = buf.subarray(offset, offset + metaLength);
  offset += metaLength;

  const authTag = buf.subarray(offset, offset + expectedTagLength);
  offset += expectedTagLength;

  return {
    algorithmId,
    version: version.toString("utf8"),
    salt,
    iv,
    meta,
    authTag,
    headerLength: offset,
  };
}

export function parseCompleteMetaBuffer(buf: Buffer): FixedBigIntStats {
  const jsonString = buf.toString("utf-8");
  return JSON.parse(jsonString, (_key, value) => {
    if (typeof value === "string" && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  }) as FixedBigIntStats;
}

const scryptAsync = promisify(crypto.scrypt);
export async function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
): Promise<Buffer> {
  return (await scryptAsync(password, salt, keyLength)) as Buffer;
}

export async function buildCompleteMetaBuffer(
  filePath: string,
): Promise<Buffer> {
  const stats = await fs.promises.stat(filePath, { bigint: true });
  const jsonString = JSON.stringify(stats, (_key, value) => {
    return typeof value === "bigint" ? value.toString() + "n" : value;
  });
  return Buffer.from(jsonString, "utf-8");
}

export async function restoreExactMetadata(
  outputFilePath: string,
  stats: FixedBigIntStats,
): Promise<void> {
  const exactAtimeSec = Number(stats.atimeNs) / 1e9;
  const exactMtimeSec = Number(stats.mtimeNs) / 1e9;
  const fileHandle = await fs.promises.open(outputFilePath, "r+");
  try {
    await fileHandle.utimes(exactAtimeSec, exactMtimeSec);
    await fileHandle.chmod(Number(stats.mode));
  } finally {
    await fileHandle.close();
  }
}
