#!/usr/bin/env node

import Commander from "./commander/index.js";
import pkgJson from "../package.json" with { type: "json" };
import EncryptInstance from "./core/encrypt/index.js";
import { SUPPORTED_ALGORITHMS } from "./algo.config.js";

const program = new Commander();

program
  .name(pkgJson.name)
  .description(pkgJson.description)
  .version(pkgJson.version);

program
  .command("encrypt")
  .description("Encrypt a file using a specified algorithm and key.")
  .option(["--key", "--k"], "The raw cryptographic key passphrase", true)
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
  .option(
    ["-a", "--algo"],
    "The cryptographic algorithm to use (default: AES-256-CBC)",
  )
  .action(async ({ options: opts }) => {
    if (opts.type && opts.file) {
      console.error(
        "Error: You cannot specify both --type and --file options.",
      );
      process.exit(1);
    }

    if (!opts.type && !opts.file) {
      console.error("Error: You must specify either --type or --file option.");
      process.exit(1);
    }

    if (opts.file && opts.nested) {
      console.error(
        "Error: You cannot specify --nested option when using --file.",
      );
      process.exit(1);
    }

    await EncryptInstance.append(opts, opts.type ? "type" : "file").encrypt();
  });

program
  .command("decrypt")
  .description("Decrypt a file using a specified algorithm and key.")
  .argument("path", "The path to the file or pattern to decrypt")
  .option(["--key", "--k"], "The raw cryptographic key passphrase", true)
  .option(["-o", "--output"], "The path to the output file or pattern")
  .option(
    ["-a", "--algo"],
    "The cryptographic algorithm to use (default: AES-256-CBC)",
  )
  .action(({ arguments: args, options: opts }) => {
    console.log("Decrypting file with the following parameters:");
    console.log("Path:", args.path);
    console.log("Key:", opts.key);
    console.log("Output:", opts.output);
  });

program
  .command("inspect")
  .description(
    "Inspect the contents of an encrypted file without decrypting it.",
  )
  .argument("path", "The path to the file or pattern to inspect")
  .action(({ arguments: args }) => {
    console.log("Inspecting file with the following parameters:");
    console.log("Path:", args.path);
  });

program
  .command("keygen")
  .description("Generate a new cryptographic key.")
  .option(
    ["-l", "--length"],
    "The length of the key in bits: 128, 192, or 256 (default: 256)",
  )
  .action(({ options: opts }) => {
    console.log("Generating key with the following parameters:");
    console.log("Length:", opts.length ?? 256);
  });
program
  .command("list")
  .description("List all algorithms supported by the tool.")
  .action(() => {
    const tableData = Object.entries(SUPPORTED_ALGORITHMS).map(
      ([profileName, config]) => ({
        "Profile Name": profileName,
        "OpenSSL Identifier": config.name,
        "IV Length": `${config.ivLength} Bytes`,
        "Auth Mode": config.isGCM ? "Authenticated (GCM)" : "Standard Block",
      }),
    );

    console.log("\nCPC Supported Cryptographic Profiles:\n");
    console.table(tableData);
  });

program.parse(process.argv);
