import { CommandBuilder } from "./command.js";
import type { CommandDefinition, ParsedResults } from "../types/command.js";
import { Help } from "./help.js";

class Commander {
  private _name: string = "";
  private _description: string = "";
  private _version: string = "";
  private commandRegistry: Map<string, CommandDefinition> = new Map();
 
  public get getProgramName(): string {
    return this._name;
  }

  public get getProgramDescription(): string {
    return this._description;
  }

  public get getProgramVersion(): string {
    return this._version;
  }

  public get commands(): CommandDefinition[] {
    return Array.from(this.commandRegistry.values());
  }
 
  name(name: string) {
    this._name = name;
    return this;
  }

  description(description: string) {
    this._description = description;
    return this;
  }

  version(version: string) {
    this._version = version;
    return this;
  }

  command(name: string) {
    if (this.commandRegistry.has(name)) {
      throw new Error(
        `Duplicate command error: "${name}" is already registered.`,
      );
    }

    return new CommandBuilder(name, (finalizedCommand) => {
      this.commandRegistry.set(finalizedCommand.name, finalizedCommand);
    });
  }

  parse(argv: string[]): void {
    const args = argv.slice(2);
    const firstInput = args[0];

    if (firstInput === "-v" || firstInput === "--version") {
      console.log(this._version);
      process.exit(0);
    }

    if (!firstInput || firstInput === "-h" || firstInput === "--help") {
      new Help(this).display();
      process.exit(0);
    }

    const matchedCommand = this.commandRegistry.get(firstInput);
    if (!matchedCommand) {
      console.error(
        `Error: Unknown command "${firstInput}". Run --help to see instructions.`,
      );
      process.exit(1);
    }

    const parsedResults: ParsedResults = {
      options: {},
      arguments: {},
    };

    const positionalTokens: string[] = [];

    for (let i = 1; i < args.length; i++) {
      const current = args[i];
      if (!current) continue;

      if (current.startsWith("-")) {
        const targetOption = matchedCommand.options.find((opt) =>
          opt.flags.includes(current),
        );

        if (!targetOption) {
          console.error(
            `Error: Unknown option flag "${current}" for command "${matchedCommand.name}".`,
          );
          process.exit(1);
        }

        const nextVal = args[i + 1];
        if (nextVal && !nextVal.startsWith("-")) {
          const longFlag =
            targetOption.flags.find((f) => f.startsWith("--")) ||
            targetOption.flags[0];
          if (longFlag) {
            const cleanKey = longFlag.replace(/^--?/, "");
            parsedResults.options[cleanKey] = nextVal;
          }
          i++;
        } else {
          console.error(
            `Error: Flag "${current}" requires an argument parameter value.`,
          );
          process.exit(1);
        }
      } else {
        positionalTokens.push(current);
      }
    }

    for (let j = 0; j < matchedCommand.arguments.length; j++) {
      const config = matchedCommand.arguments[j];
      const token = positionalTokens[j];

      if (config) {
        if (token) {
          parsedResults.arguments[config.name] = token;
        } else if (config.required) {
          console.error(
            `Error: Missing required structural input argument <${config.name}>.`,
          );
          process.exit(1);
        }
      }
    }

    if (positionalTokens.length > matchedCommand.arguments.length) {
      const extraToken = positionalTokens[matchedCommand.arguments.length];
      console.error(
        `Error: Unexpected standalone parameter input content token found: "${extraToken}"`,
      );
      process.exit(1);
    }

    for (const reqOpt of matchedCommand.options) {
      const longFlag =
        reqOpt.flags.find((f) => f.startsWith("--")) || reqOpt.flags[0];
      const cleanKey = longFlag ? longFlag.replace(/^--?/, "") : "";
      if (reqOpt.required && parsedResults.options[cleanKey] === undefined) {
        console.error(
          `Error: Missing required functional flag option: (${reqOpt.flags.join(", ")}).`,
        );
        process.exit(1);
      }
    }
    matchedCommand.action(parsedResults);
  }
}

export default Commander;
