export interface CommandOption {
  flags: string[];
  description: string;
  required: boolean;
}

export interface CommandArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface ParsedResults {
  options: Record<string, string | boolean>;
  arguments: Record<string, string>;
}

export interface CommandDefinition {
  name: string;
  description: string;
  options: CommandOption[];
  arguments: CommandArgument[];
  action: (parsed: ParsedResults) => void | Promise<void>;
}

export interface HelpTarget {
  getProgramName: string;
  getProgramDescription: string;
  getProgramVersion: string;
  commands: CommandDefinition[];
}