#!/usr/bin/env node

import {
  algorithm,
  error,
  inputKeys,
  intro,
  isCancel,
  outro,
} from "./prompts.js";
import Commander from "./commander/index.js";
import pkgJson from "../package.json" with { type: "json" };
import EncryptInstance from "./core/encrypt/index.js";
import { SUPPORTED_ALGORITHMS } from "./algo.config.js";
import DecryptInstance from "./core/decrypt/index.js";

const program = new Commander();

program
  .name(pkgJson.name)
  .description(pkgJson.description)
  .version(pkgJson.version);

program
  .command("encrypt")
  .description("Encrypt a file using a specified algorithm and key.")
  .option(
    ["--type"],
    "Target classification file extension or pattern (e.g., .txt, .jpg, *.log or .png,.jpg) (no-default)",
  )
  .option(
    ["--file"],
    "Target classification file  (e.g., abc.txt, my_pic.jpg, *.log) (no-default)",
  )
  .option(
    ["-n", "--nested"],
    "Include subdirectories in the search for files to encrypt (default: false)",
  )
  .option(
    ["-i", "--input"],
    "The path to the input file or pattern default: . (current directory)",
  )
  .option(
    ["-o", "--output"],
    "The path to the output file or pattern default: ./encrypted/*",
  )
  .action(async ({ options: opts }) => {
    intro("Welcome to Client-to-Provider Cipher (CPC) - Encrypt Command");
    if (opts.type && opts.file) {
      error("Error: You cannot specify both --type and --file options.");
      process.exit(1);
    }

    if (!opts.type && !opts.file) {
      error("Error: You must specify either --type or --file option.");
      process.exit(1);
    }

    if (opts.file && opts.nested) {
      error("Error: You cannot specify --nested option when using --file.");
      process.exit(1);
    }

    const key = await inputKeys();
    if (isCancel(key)) process.exit(0);
    const algo = await algorithm();
    if (isCancel(algo)) process.exit(0);
    await EncryptInstance.append(
      { ...opts, key, algo },
      opts.type ? "type" : "file",
    ).encrypt();

    outro("Encryption process completed successfully!");
  });

program
  .command("decrypt")
  .description("Decrypt a file using a specified algorithm and key.")
  .option(["--file", "--f"], "The path to the file or pattern to decrypt")
  .option(["--path", "--p"], "The path to the file or pattern to decrypt")
  .option(["-o", "--output"], "The path to the output file or pattern")
  .action(async ({ options: opts }) => {
    intro("Welcome to Client-to-Provider Cipher (CPC) - Decrypt Command");
    const key = await inputKeys();
    if (isCancel(key)) process.exit(0);
    const algo = await algorithm();
    if (isCancel(algo)) process.exit(0);
    await DecryptInstance.append({ ...opts, key, algo }).decrypt();
    outro("Decryption process completed successfully!");
  });

program
  .command("list")
  .description("List all algorithms supported by the tool.")
  .action(() => {
    intro("CPC Supported Cryptographic Profiles:");
    const tableData = Object.entries(SUPPORTED_ALGORITHMS).map(
      ([profileName, config]) => ({
        "Profile Name": profileName,
        "OpenSSL Identifier": config.name,
        "IV Length": `${config.ivLength} Bytes`,
        "Auth Mode": config.isGCM ? "Authenticated (GCM)" : "Standard Block",
      }),
    );
    console.table(tableData);
    outro("End of Supported Algorithms List");
  });

program.parse(process.argv);
