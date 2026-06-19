import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import {
  deriveKey,
  parseCompleteMetaBuffer,
  restoreExactMetadata,
  parseHeader,
  ALGORITHM_ID_MAP,
} from "../../algo.config.js";
import { error, message } from "../../prompts.js";
import { noFilesFoundMessage } from "../grace/index.js";

interface DecryptOptions {
  key: string;
  path: string;
  output: string;
  file: string[] | null;
}

class Decrypt {
  private options: DecryptOptions = {
    key: "",
    path: ".",
    output: "decrypted",
    file: null,
  };

  private magic = Buffer.from("C2P1");

  append(options: Record<string, any>) {
    this.options.key = options.key || this.options.key;
    this.options.path = options.path || this.options.path;
    this.options.output = options.output || this.options.output;
    this.options.file = options.file
      ? options.file.split(" ")
      : this.options.file;
    return this;
  }

  private async getFilesList(): Promise<string[]> {
    const startPath = path.resolve(process.cwd(), this.options.path);
    const allFiles: string[] = [];

    const targetFiles = new Set<string>(
      this.options.file
        ? this.options.file.map((f) => path.resolve(process.cwd(), f))
        : [],
    );

    const isEncryptedFile = (filePath: string) =>
      path.extname(filePath) === ".enc";

    const scan = async (currentPath: string) => {
      try {
        const dir = await fs.promises.opendir(currentPath);
        for await (const dirent of dir) {
          const fullPath = path.join(currentPath, dirent.name);

          if (dirent.isFile()) {
            if (this.options.file && targetFiles.has(fullPath)) {
              allFiles.push(fullPath);
            } else if (!this.options.file && isEncryptedFile(fullPath)) {
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
    const fd = await fs.promises.open(filePath, "r");
    let keyBuffer: Buffer | null = null;

    try {
      const fixedFieldsLength = this.magic.length + 1 + 1 + 1 + 1 + 4;

      const fixedBuffer = Buffer.alloc(fixedFieldsLength);
      await fd.read(fixedBuffer, 0, fixedFieldsLength, 0);

      const magicSlice = fixedBuffer.subarray(0, this.magic.length);

      if (!magicSlice.equals(this.magic)) {
        throw new Error(
          "Invalid cryptographic file format: Missing signature identification marker.",
        );
      }

      let offset = this.magic.length;

      const algorithmId = fixedBuffer.readUInt8(offset);
      offset += 1;

      const algorithm = ALGORITHM_ID_MAP[algorithmId];

      if (!algorithm) {
        throw new Error(`Unsupported algorithm id: ${algorithmId}`);
      }

      const versionLength = fixedBuffer.readUInt8(offset);
      offset += 1;

      const saltLength = fixedBuffer.readUInt8(offset);
      offset += 1;

      const ivLength = fixedBuffer.readUInt8(offset);
      offset += 1;

      const metaLength = fixedBuffer.readUInt32BE(offset);
      offset += 4;

      const expectedTagLength = algorithm.isGCM ? algorithm.tagLength : 0;

      const totalHeaderLength =
        fixedFieldsLength +
        versionLength +
        saltLength +
        ivLength +
        metaLength +
        expectedTagLength;

      const fullHeaderBuffer = Buffer.alloc(totalHeaderLength);

      await fd.read(fullHeaderBuffer, 0, totalHeaderLength, 0);

      const { salt, iv, meta, authTag, headerLength } = parseHeader(
        fullHeaderBuffer,
        this.magic.length,
        expectedTagLength,
      );

      keyBuffer = await deriveKey(this.options.key, salt, algorithm.keyLength);

      const decipher = crypto.createDecipheriv(algorithm.name, keyBuffer, iv);

      if (algorithm.isGCM) {
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

      fs.mkdirSync(path.dirname(outputFilePath), {
        recursive: true,
      });

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
        `▲ Decryption stream aborted for ${path.basename(filePath)}:`,
        err as any,
      );
      throw err;
    } finally {
      if (keyBuffer) {
        keyBuffer.fill(0);
      }

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
    const stats = await Promise.all(
      targets.map((file) => fs.promises.stat(file)),
    );

    const totalBytes = stats.reduce((sum, stat) => sum + stat.size, 0);
    const throughput = totalBytes / 1024 / 1024 / Number(timeTakenSeconds);
    message(
      `Decryption completed in ${timeTakenSeconds} seconds for ${targets.length} file(s) with a total size of ${(totalBytes / (1024 * 1024)).toFixed(2)} MB. Average throughput: ${throughput.toFixed(2)} MB/s.`,
    );

    if (failureCount > 0) {
      error(
        `Decryption completed with ${failureCount} failure(s) and ${successCount} success(es).`,
      );
    } else {
      message(
        `Success: All ${successCount} file(s) decrypted and verified successfully.`,
      );
    }
  }
}

const DecryptInstance = new Decrypt();
export default DecryptInstance;
