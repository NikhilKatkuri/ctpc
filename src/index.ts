import Commander from "./commander/index.js";
import pkgJson from "../package.json" with { type: "json" };

const program = new Commander();

program
  .name(pkgJson.name)
  .description(pkgJson.description)
  .version(pkgJson.version);

program
  .command("encrypt")
  .description("Encrypt a file using a specified algorithm and key.")
  .argument("type", "Target classification (file or pattern)")
  .argument("key", "The raw cryptographic key passphrase")
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
  .action(({ arguments: args, options: opts }) => {
    console.log("Encrypting file with the following parameters:");
    console.log("Type:", args.type);
    console.log("Key:", args.key);
    console.log("Input:", opts.input);
    console.log("Output:", opts.output);
  });

program
  .command("decrypt")
  .description("Decrypt a file using a specified algorithm and key.")
  .argument("path", "The path to the file or pattern to decrypt")
  .argument("key", "The raw cryptographic key passphrase")
  .option(["-o", "--output"], "The path to the output file or pattern")
  .option(
    ["-a", "--algo"],
    "The cryptographic algorithm to use (default: AES-256-CBC)",
  )
  .action(({ arguments: args, options: opts }) => {
    console.log("Decrypting file with the following parameters:");
    console.log("Path:", args.path);
    console.log("Key:", args.key);
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
    console.log("Listing supported algorithms...");
  });

program.parse(process.argv);
