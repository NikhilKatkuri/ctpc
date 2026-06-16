import type {
  CommandDefinition,
  CommandOption,
  CommandArgument
} from "../types/command.js";

export class CommandBuilder {
  private _name: string;
  private _description: string = "";
  private _options: CommandOption[] = [];
  private _arguments: CommandArgument[] = [];
  private _action: CommandDefinition["action"] = () => {};

  constructor(
    name: string,
    private onRegister: (cmd: CommandDefinition) => void,
  ) {
    this._name = name;
  }

  description(desc: string) {
    this._description = desc;
    return this;
  }
 
  option(flags: string[], description: string, required: boolean = false) {
    this._options.push({ flags, description, required });
    return this;
  }
 
  argument(name: string, description: string, required: boolean = true) {
    this._arguments.push({ name, description, required });
    return this;
  }

  action(fn: CommandDefinition["action"]) {
    this._action = fn;
    this.onRegister({
      name: this._name,
      description: this._description,
      options: this._options,
      arguments: this._arguments,
      action: this._action,
    });
    return this;
  }
}
