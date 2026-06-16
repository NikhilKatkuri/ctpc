import type { HelpTarget } from "../types/command.js";

export class Help {
  constructor(private program: HelpTarget) {}

  display(): void {
    console.log(
      `\nUsage: ${this.program.getProgramName} [command] [arguments] [options]\n`,
    );

    if (this.program.getProgramDescription) {
      console.log(`${this.program.getProgramDescription}\n`);
    }

    console.log(`Options:`);
    console.log(
      `  -v, --version        Output the current version (${this.program.getProgramVersion})`,
    );
    console.log(`  -h, --help           Display this help menu information\n`);

    const commands = this.program.commands;
    if (commands.length > 0) {
      console.log(`Available Commands:`);

      for (const cmd of commands) {
        const argStrings = cmd.arguments
          .map((arg) => (arg.required ? `<${arg.name}>` : `[${arg.name}]`))
          .join(" ");
        const usageLine = `${cmd.name} ${argStrings}`.padEnd(25);

        console.log(`  ${usageLine} ${cmd.description}`);

        if (cmd.options && cmd.options.length > 0) {
          for (const opt of cmd.options) {
            const flagsStr = opt.flags.join(", ").padEnd(21);
            console.log(
              `    ${flagsStr} ${opt.description}${opt.required ? " (Required)" : ""}`,
            );
          }
        }
        console.log("");
      }
    }
  }
}
