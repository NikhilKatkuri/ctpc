export function noFilesFoundMessage() {
  console.error("No target files specified.");
  console.error("\nPlease specify the target files using the --file option.");
  return process.exit(0);
}
export function noFilesTypeFoundMessage() {
  console.error("No target file types specified.");
  console.error("\nPlease specify the target file types using the --type option.");
  return process.exit(0);
}
