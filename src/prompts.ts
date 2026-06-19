import { WriteStream } from "node:tty";
import { SUPPORTED_ALGORITHMS } from "./algo.config.js";

const ESC = "\x1b[";
const R = "\x1b[0m";

const ansi = {
  eraseLine: `${ESC}2K`,
  cursorUp: (n = 1) => `${ESC}${n}A`,
  cursorCol: (n = 0) => `${ESC}${n}G`,
  hideCursor: `${ESC}?25l`,
  showCursor: `${ESC}?25h`,
};

const c = {
  dim: (s: string) => `\x1b[2m${s}${R}`,
  bold: (s: string) => `\x1b[1m${s}${R}`,
  green: (s: string) => `\x1b[32m${s}${R}`,
  red: (s: string) => `\x1b[31m${s}${R}`,
  yellow: (s: string) => `\x1b[33m${s}${R}`,
  cyan: (s: string) => `\x1b[36m${s}${R}`,
  white: (s: string) => `\x1b[37m${s}${R}`,
  gray: (s: string) => `\x1b[90m${s}${R}`,
};

const S = {
  barStart: "┌",
  bar: "│",
  barEnd: "└",
  barH: "─",
  step_active: "◆",
  step_submit: "◇",
  step_cancel: "■",
  step_error: "▲",
  radio_active: "●",
  radio_inactive: "○",
  tick: "✔",
  cross: "✘",
};

const out = process.stdout as WriteStream;
const write = (s: string) => out.write(s);
const writeln = (s: string) => out.write(s + "\n");

function clearLines(n: number) {
  for (let i = 0; i < n; i++) {
    write(ansi.cursorUp() + ansi.eraseLine);
  }
  write(ansi.cursorCol(0));
}

function readKey() {
  return new Promise<{ name: string; ctrl: boolean; char: string }>(
    (resolve) => {
      const { stdin } = process;
      if (stdin.isTTY) stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding("utf8");

      stdin.once("data", (chunk: string) => {
        stdin.pause();
        if (stdin.isTTY) stdin.setRawMode(false);

        let name = chunk;
        let ctrl = false;

        if (chunk === "\r" || chunk === "\n") name = "return";
        else if (chunk === "\x7f") name = "backspace";
        else if (chunk === "\x1b") name = "escape";
        else if (chunk === "\x1b[A") name = "up";
        else if (chunk === "\x1b[B") name = "down";
        else if (chunk.charCodeAt(0) < 32) {
          ctrl = true;
          name = String.fromCharCode(chunk.charCodeAt(0) + 96);
        }

        resolve({ name, ctrl, char: chunk });
      });
    },
  );
}

export function intro(title = "") {
  writeln("");
  writeln(c.gray(S.barStart + S.barH + S.barH + " ") + c.green(title));
  writeln(c.gray(S.bar));
}

export function outro(message = "") {
  writeln(c.gray(S.bar));
  writeln(c.gray(S.barEnd + S.barH + S.barH + " ") + c.dim(message));
  writeln("");
}

export const CANCEL = Symbol("cancel");
export function isCancel(v: unknown): v is symbol {
  return v === CANCEL;
}

export async function password(opts: {
  message: string;
  mask?: string;
  validate?: (v: string) => string | undefined;
}): Promise<string | symbol> {
  const { message, mask = "●", validate } = opts;

  let value = "";
  let error = "";
  let currentState: "active" | "error" = "active";

  const drawPrompt = (state: "active" | "error"): number => {
    const icon =
      state === "error" ? c.yellow(S.step_error) : c.cyan(S.step_active);
    const masked = mask.repeat(value.length) || c.dim("type your secret…");

    writeln(`${icon}  ${c.bold(message)}`);
    writeln(`${c.gray(S.bar)}  ${c.green(masked)}`);

    if (state === "error") {
      writeln(`${c.gray(S.bar)}  ${c.yellow(S.step_error)} ${c.red(error)}`);
      writeln(
        `${c.gray(S.barEnd + S.barH + S.barH)} ${c.dim("fix the error above, then press Enter")}`,
      );
      return 4;
    }

    writeln(
      `${c.gray(S.barEnd + S.barH + S.barH)} ${c.dim("Enter to confirm · Esc to cancel")}`,
    );
    return 3;
  };

  writeln(c.gray(S.bar));
  let lineCount = 1 + drawPrompt(currentState);

  while (true) {
    const key = await readKey();

    if ((key.ctrl && key.name === "c") || key.name === "escape") {
      clearLines(lineCount);
      writeln(
        `${c.gray(S.step_cancel)}  ${c.bold(message)}  ${c.dim("(cancelled)")}`,
      );
      return CANCEL;
    }

    if (key.name === "return") {
      const err = validate?.(value);
      if (err) {
        error = err;
        clearLines(lineCount - 1);
        currentState = "error";
        lineCount = 1 + drawPrompt(currentState);
        continue;
      }
      clearLines(lineCount);
      writeln(`${c.green(S.step_submit)}  ${c.bold(message)}`);
      writeln(`${c.gray(S.bar)}  ${c.dim(mask.repeat(value.length))}`);
      return value;
    }

    if (key.name === "backspace") {
      value = value.slice(0, -1);
      error = "";
      clearLines(lineCount - 1);
      currentState = "active";
      lineCount = 1 + drawPrompt(currentState);
      continue;
    }

    if (key.char.length === 1 && !key.ctrl) {
      value += key.char;
      error = "";
      clearLines(lineCount - 1);
      currentState = "active";
      lineCount = 1 + drawPrompt(currentState);
    }
  }
}

export interface SelectOption<T> {
  value: T;
  label: string;
  hint?: string;
}

export async function select<T>(opts: {
  message: string;
  options: SelectOption<T>[];
  initialValue?: T;
}): Promise<T | symbol> {
  const { message, options, initialValue } = opts;

  let cursor = Math.max(
    0,
    options.findIndex((o) => o.value === initialValue),
  );

  const renderPrompt = (): number => {
    writeln(`${c.cyan(S.step_active)}  ${c.bold(message)}`);

    for (let i = 0; i < options.length; i++) {
      const opt = options[i]!;
      const active = i === cursor;
      const radio = active ? c.cyan(S.radio_active) : c.dim(S.radio_inactive);
      const label = active ? c.bold(opt.label) : c.dim(opt.label);
      const hint = opt.hint ? c.dim(" · " + opt.hint) : "";
      writeln(`${c.gray(S.bar)}  ${radio} ${label}${hint}`);
    }

    writeln(
      `${c.gray(S.barEnd + S.barH + S.barH + " ")}${c.dim("↑/↓ navigate · ↵ select")}`,
    );
    return 2 + options.length;
  };

  writeln(c.gray(S.bar));
  let lineCount = 1 + renderPrompt();

  while (true) {
    const key = await readKey();

    if ((key.ctrl && key.name === "c") || key.name === "escape") {
      clearLines(lineCount);
      writeln(
        `${c.gray(S.step_cancel)}  ${c.bold(message)}  ${c.dim("(cancelled)")}`,
      );
      return CANCEL;
    }

    if (key.name === "up") {
      cursor = (cursor - 1 + options.length) % options.length;
      clearLines(lineCount - 1);
      lineCount = 1 + renderPrompt();
    } else if (key.name === "down") {
      cursor = (cursor + 1) % options.length;
      clearLines(lineCount - 1);
      lineCount = 1 + renderPrompt();
    } else if (key.name === "return") {
      const chosen = options[cursor]!;
      clearLines(lineCount);
      writeln(`${c.green(S.step_submit)}  ${c.bold(message)}`);
      writeln(`${c.gray(S.bar)}  ${c.dim(chosen.label)}`);
      return chosen.value;
    }
  }
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function spinner() {
  let frame = 0;
  let msg = "";
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    write(ansi.cursorCol(0) + ansi.eraseLine);
    const icon = c.cyan(SPINNER_FRAMES[frame % SPINNER_FRAMES.length]!);
    write(`${c.gray(S.bar)}  ${icon}  ${msg}`);
    frame++;
  };

  return {
    start(message = "") {
      msg = message;
      write(ansi.hideCursor);
      writeln(c.gray(S.bar));
      tick();
      timer = setInterval(tick, 80);
    },

    stop(message = "", code = 0) {
      if (timer) clearInterval(timer);
      write(ansi.cursorCol(0) + ansi.eraseLine);
      const icon = code === 0 ? c.green(S.tick) : c.red(S.cross);
      writeln(`${c.gray(S.bar)}  ${icon}  ${message || msg}`);
      write(ansi.showCursor);
    },

    message(m: string) {
      msg = m;
    },
  };
}

export function note(message: string, title = "") {
  const lines = message.split("\n");
  const maxLen = Math.max(title.length, ...lines.map((l) => l.length));
  const bar = S.barH.repeat(maxLen + 2);

  writeln(c.gray(S.bar));
  writeln(
    c.gray(S.barStart + S.barH) +
      " " +
      c.bold(title) +
      " " +
      c.gray(S.barH.repeat(maxLen - title.length + 1)),
  );
  for (const line of lines) {
    writeln(c.gray(S.bar) + "  " + line);
  }
  writeln(c.gray(S.barEnd + bar));
}

export function message(message: string) {
  writeln(c.gray(S.bar + S.barH + " " + message));
  writeln(c.gray(S.bar));
}

export function error(message: string, err?: unknown) {
  writeln(c.gray(S.bar));
  writeln(
    c.gray(S.bar) + "  " + c.red(S.step_error) + "  " + c.bold(c.red(message)),
  );
  if (err) {
    writeln(
      c.gray(S.bar) +
        "  " +
        c.red(err instanceof Error ? err.message : String(err)),
    );
  }
  writeln(c.gray(S.bar));
}

export async function algorithm() {
  return await select({
    message: "Select the encryption algorithm:",
    options: Object.entries(SUPPORTED_ALGORITHMS).map(
      ([profileName, config]) => ({
        label: `${profileName} (${config.name})`,
        value: profileName,
      }),
    ),
  });
}

export async function inputKeys() {
  const key = await password({
    mask: "*",
    message: "Enter the encryption key:",
    validate: (input) => {
      if (input.length < 6) return "Must be at least 6 characters.";
      if (!/[A-Z]/.test(input))
        return "Must include at least one uppercase letter.";
      if (!/[a-z]/.test(input))
        return "Must include at least one lowercase letter.";
      if (!/[0-9]/.test(input)) return "Must include at least one number.";
      if (!/[^A-Za-z0-9]/.test(input))
        return "Must include at least one special character (!@#$%^&* …).";
      return undefined;
    },
  });

  if (isCancel(key)) process.exit(0);
  const confirmKey = await password({
    mask: "*",
    message: "Confirm the encryption key:",
    validate: (input) => {
      if (input !== key) return "Keys do not match. Please try again.";
      return undefined;
    },
  });

  if (isCancel(confirmKey)) process.exit(0);
  if (confirmKey !== key) {
    error("Error: Keys do not match. Please try again.");
    process.exit(1);
  }
  return key;
}
