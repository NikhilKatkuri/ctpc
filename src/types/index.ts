export interface ParsedHeader {
  salt: Buffer;
  iv: Buffer;
  meta: Buffer;
  authTag: Buffer;
  headerLength: number;
}

export interface FixedBigIntStats {
  dev: bigint;
  mode: bigint;
  nlink: bigint;
  uid: bigint;
  gid: bigint;
  rdev: bigint;
  blksize: bigint;
  ino: bigint;
  size: bigint;
  blocks: bigint;
  atimeMs: bigint;
  mtimeMs: bigint;
  ctimeMs: bigint;
  birthtimeMs: bigint;
  atimeNs: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
  birthtimeNs: bigint;
}

export interface EncryptOptions {
  type: string[] | null;
  file: string[] | null;
  nested: boolean;
  key: string;
  input: string;
  output: string;
  algo: string;
}