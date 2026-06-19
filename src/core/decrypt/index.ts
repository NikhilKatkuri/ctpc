import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import {
  SUPPORTED_ALGORITHMS,
  deriveKey,
  parseCompleteMetaBuffer,
  restoreExactMetadata,
  parseHeader,
} from "../../algo.config.js";
import { error, message } from "../../prompts.js";
import { noFilesFoundMessage } from "../grace/index.js";

interface DecryptOptions {
  key: string;
  path: string;
  output: string;
  algo: string;
}

class Decrypt {
  private options: DecryptOptions = {
    key: "",
    path: ".",
    output: "decrypted",
    algo: "AES-256-CBC",
  };

  private magic = Buffer.from("C2P1");
  private selectedAlgorithm!: (typeof SUPPORTED_ALGORITHMS)[keyof typeof SUPPORTED_ALGORITHMS];

  constructor() {
    this.refreshAlgorithmConfig();
  }

  private refreshAlgorithmConfig() {
    const algoKey =
      this.options.algo.toUpperCase() as keyof typeof SUPPORTED_ALGORITHMS;
    this.selectedAlgorithm =
      SUPPORTED_ALGORITHMS[algoKey] || SUPPORTED_ALGORITHMS["AES-256-CBC"];
  }

  append(options: Record<string, any>) {
    this.options.key = options.key || this.options.key;
    this.options.path = options.path || this.options.path;
    this.options.output = options.output || this.options.output;
    this.options.algo = options.algo || this.options.algo;

    this.refreshAlgorithmConfig();
    return this;
  }

  private async getFilesList(): Promise<string[]> {
    const startPath = path.resolve(process.cwd(), this.options.path);
    const allFiles: string[] = [];

    const scan = async (currentPath: string) => {
      try {
        const dir = await fs.promises.opendir(currentPath);
        for await (const dirent of dir) {
          const fullPath = path.join(currentPath, dirent.name);

          if (dirent.isFile()) {
            if (path.extname(dirent.name) === ".enc") {
              allFiles.push(fullPath);
            }
          } else if (dirent.isDirectory()) {
            await scan(fullPath);
          }
        }
      } catch (err) {
        error(`Error scanning decryption target path ${currentPath}:`, err);
      }
    };

    await scan(startPath);
    return allFiles;
  }
  async decryptFile(filePath: string) {
    const isGCM = this.selectedAlgorithm.isGCM;
    const fd = await fs.promises.open(filePath, "r");
    let keyBuffer: Buffer | null = null;

    try {
      const fixedFieldsLength = this.magic.length + 1 + 1 + 1 + 4;
      const fixedBuffer = Buffer.alloc(fixedFieldsLength);
      await fd.read(fixedBuffer, 0, fixedFieldsLength, 0);

      const magicSlice = fixedBuffer.subarray(0, this.magic.length);
      if (!magicSlice.equals(this.magic)) {
        throw new Error(
          "Invalid cryptographic file format: Missing signature identification marker.",
        );
      }

      let offset = this.magic.length;
      const versionLength = fixedBuffer.readUInt8(offset);
      offset += 1;
      const saltLength = fixedBuffer.readUInt8(offset);
      offset += 1;
      const ivLength = fixedBuffer.readUInt8(offset);
      offset += 1;
      const metaLength = fixedBuffer.readUInt32BE(offset);
      offset += 4;

      const expectedTagLength = isGCM ? this.selectedAlgorithm.tagLength : 0;

      const totalHeaderLength =
        fixedFieldsLength +
        versionLength +
        saltLength +
        ivLength +
        metaLength +
        expectedTagLength;

      const fullHeaderBuffer = Buffer.alloc(totalHeaderLength);
      await fd.read(fullHeaderBuffer, 0, totalHeaderLength, 0);

      const { salt, iv, headerLength, meta, authTag } = parseHeader(
        fullHeaderBuffer,
        this.magic.length,
        expectedTagLength,
      );

      keyBuffer = await deriveKey(
        this.options.key,
        salt,
        this.selectedAlgorithm.keyLength,
      );
      const decipher = crypto.createDecipheriv(
        this.selectedAlgorithm.name,
        keyBuffer,
        iv,
      );

      if (isGCM) {
        (decipher as crypto.DecipherGCM).setAuthTag(authTag);
      }

      const startPath = path.resolve(process.cwd(), this.options.path);
      const relativePath = path.relative(startPath, filePath);
      const cleanRelativePath = relativePath.substring(
        0,
        relativePath.length - 4,
      );
      const outputFilePath = path.resolve(
        process.cwd(),
        this.options.output,
        cleanRelativePath,
      );

      fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });

      const fileStats = await fd.stat();
      const inputStream = fs.createReadStream(filePath, {
        start: headerLength,
        end: Number(fileStats.size) - 1,
      });
      const outputStream = fs.createWriteStream(outputFilePath);

      await pipeline(inputStream, decipher, outputStream);

      const restoredStates = parseCompleteMetaBuffer(meta);
      await restoreExactMetadata(outputFilePath, restoredStates);

      message(
        `🔓 Decrypted: ${relativePath} -> ${path.basename(outputFilePath)}`,
      );
    } catch (err) {
      error(
        `▲  Decryption stream aborted for ${path.basename(filePath)}:`,
        err as any,
      );
      throw err;
    } finally {
      if (keyBuffer) keyBuffer.fill(0);
      await fd.close();
    }
  }
  async decrypt() {
    const targets = await this.getFilesList();

    if (targets.length === 0) {
      noFilesFoundMessage();
      return;
    }

    message(
      `Vault verification complete. Processing ${targets.length} encrypted datablocks...`,
    );

    const startTime = performance.now();
    const BATCH_SIZE = 10;

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const currentBatch = targets.slice(i, i + BATCH_SIZE);
      const batchPromises = currentBatch.map(async (filePath) => {
        try {
          await this.decryptFile(filePath);
          successCount++;
        } catch (err) {
          failureCount++;
        }
      });

      await Promise.all(batchPromises);
    }
    const endTime = performance.now();
    const timeTakenSeconds = ((endTime - startTime) / 1000).toFixed(2);

    message(
      `Decryption completed in ${timeTakenSeconds} seconds for ${targets.length} file(s).`,
    );

    if (failureCount > 0) {
      error(
        `Decryption completed with ${failureCount} failure(s) and ${successCount} success(es).`,
      );
    } else {
      message(
        `Success: All target items parsed and decrypted safely. Length: ${successCount}`,
      );
    }
  }
}

const DecryptInstance = new Decrypt();
export default DecryptInstance;
