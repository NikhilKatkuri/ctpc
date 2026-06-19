import fs from "fs";
import path from "path";
import crypto from "node:crypto";
import {
  noFilesFoundMessage,
  noFilesTypeFoundMessage,
} from "../grace/index.js";
import {
  buildCompleteMetaBuffer,
  buildHeader,
  deriveKey,
  SUPPORTED_ALGORITHMS,
} from "../../algo.config.js";
import { pipeline } from "node:stream/promises";
import type { EncryptOptions } from "../../types/index.js";

class Encrypt {
  private options: EncryptOptions = {
    type: null,
    file: null,
    nested: false,
    key: "",
    input: ".",
    output: "encrypted",
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

  append(options: Record<string, any>, use: "type" | "file" = "type") {
    if (use === "type" && options.type) {
      this.options.type = options.type
        .toString()
        .split(",")
        .map((t: string) => t.trim());
      this.options.file = null;
    } else if (options.file) {
      this.options.file = options.file
        .toString()
        .split(",")
        .map((f: string) => f.trim());
      this.options.type = null;
    }

    this.options.nested =
      options.nested !== undefined ? options.nested : this.options.nested;
    this.options.key = options.key || this.options.key;
    this.options.input = options.input || this.options.input;
    this.options.output = options.output || this.options.output;
    this.options.algo = options.algo || this.options.algo;

    this.refreshAlgorithmConfig();
    return this;
  }

  private async getFilesList(): Promise<string[]> {
    if (!this.options.type) return [];

    const startPath = path.resolve(process.cwd(), this.options.input);
    const allowSubdirectories = this.options.nested;
    const targetTypes = new Set(this.options.type);
    const allFiles: string[] = [];

    const scan = async (currentPath: string) => {
      try {
        const dir = await fs.promises.opendir(currentPath);
        for await (const dirent of dir) {
          const fullPath = path.join(currentPath, dirent.name);

          if (dirent.isFile()) {
            if (targetTypes.has(path.extname(dirent.name))) {
              allFiles.push(fullPath);
            }
          } else if (dirent.isDirectory() && allowSubdirectories) {
            await scan(fullPath);
          }
        }
      } catch (err) {
        console.error(`Error scanning path ${currentPath}:`, err);
      }
    };

    await scan(startPath);
    return allFiles;
  }

  private async getFile(): Promise<string[]> {
    if (!this.options.file) return [];

    const startPath = path.resolve(process.cwd(), this.options.input);
    const targetNames = new Set(
      this.options.file.map((f: string) => path.basename(f.trim())),
    );
    const allFiles: string[] = [];

    try {
      const dir = await fs.promises.opendir(startPath);
      for await (const dirent of dir) {
        const fullPath = path.join(startPath, dirent.name);
        if (dirent.isFile() && targetNames.has(dirent.name)) {
          allFiles.push(fullPath);
        }
      }
    } catch (err) {
      console.error(`Error scanning path ${startPath}:`, err);
    }

    return allFiles;
  }

  private checkAndCreateOutputDir() {
    const outputDir = path.resolve(process.cwd(), this.options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  async encryptFile(filePath: string) {
    const isGCM = this.selectedAlgorithm.isGCM;

    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(this.selectedAlgorithm.ivLength);
    const authTagLength = isGCM ? this.selectedAlgorithm.tagLength : 0;

    const metaBuffer = await buildCompleteMetaBuffer(filePath);
    const header = buildHeader(salt, iv, metaBuffer, this.magic, authTagLength);

   const key = await deriveKey(
     this.options.key,
     salt,
     this.selectedAlgorithm.keyLength,
   );
    const cipher = crypto.createCipheriv(this.selectedAlgorithm.name, key, iv);

    const inputStream = fs.createReadStream(filePath);

    const startPath = path.resolve(process.cwd(), this.options.input);
    const relativePath = path.relative(startPath, filePath);

    const outputFilePath = path.resolve(
      process.cwd(),
      this.options.output,
      relativePath + ".enc",
    );

    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });

    const outputStream = fs.createWriteStream(outputFilePath);

    try {
      outputStream.write(header);

      await pipeline(inputStream, cipher, outputStream);

      if (isGCM) {
        const authTag = (cipher as crypto.CipherGCM).getAuthTag();
        await fs.promises.appendFile(outputFilePath, authTag);
      }

      console.log(
        `Encrypted ${path.basename(filePath)} -> ${path.basename(outputFilePath)}`,
      );
    } catch (error) {
      outputStream.destroy();
      if (fs.existsSync(outputFilePath)) {
        await fs.promises.unlink(outputFilePath).catch(() => null);
      }
      console.error(`Error processing file ${filePath}:`, error);
      throw error;
    } finally {
      key.fill(0);
    }
  }

  async encrypt() {
    let filesToEncrypt: string[] = [];
    if (this.options.type) {
      filesToEncrypt = await this.getFilesList();
    } else if (this.options.file) {
      filesToEncrypt = await this.getFile();
    }

    if (filesToEncrypt.length === 0) {
      if (this.options.type) noFilesTypeFoundMessage();
      else noFilesFoundMessage();
      return;
    }

    console.log(`Found ${filesToEncrypt.length} file(s) to encrypt.`);
    this.checkAndCreateOutputDir();

    const BATCH_SIZE = 10;
    for (let i = 0; i < filesToEncrypt.length; i += BATCH_SIZE) {
      const currentBatch = filesToEncrypt.slice(i, i + BATCH_SIZE);
      const batchPromises = currentBatch.map((filePath) =>
        this.encryptFile(filePath),
      );
      await Promise.all(batchPromises);
    }

    console.log(`\nSuccess: All batches flushed out cleanly.`);
  }
}

const EncryptInstance = new Encrypt();

export default EncryptInstance;
