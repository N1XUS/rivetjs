// Tiny terminal prompts on node:readline (no dependencies): text, yes/no, and a choice list (arrow keys on a
// TTY, a numbered answer otherwise). Every prompt takes its streams, so tests drive them with PassThrough.
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import { paint } from "./output.ts";

export interface PromptIO {
  input: NodeJS.ReadableStream & { isTTY?: boolean; setRawMode?: (mode: boolean) => unknown };
  output: NodeJS.WritableStream;
  env?: Record<string, string | undefined>;
}

/** Thrown when the user cancels (Ctrl+C, Ctrl+D / end of input). */
export class PromptCancelled extends Error {
  constructor() {
    super("cancelled");
  }
}

const color = (format: Parameters<typeof paint>[0], text: string, io: PromptIO) => paint(format, text, io.output, io.env);

interface Reader {
  close: () => void;
  next: () => Promise<string | null>;
}
const readers = new WeakMap<object, Reader>();

/** One line reader per input stream (a reader per question would drop lines buffered after the first). */
function reader(io: PromptIO): Reader {
  let current = readers.get(io.input);
  if (current) return current;
  const rl = createInterface({ input: io.input, terminal: false });
  const queue: (string | null)[] = [];
  const waiters: ((value: string | null) => void)[] = [];
  const push = (value: string | null) => (waiters.length ? waiters.shift()!(value) : queue.push(value));
  rl.on("line", push);
  rl.on("close", () => push(null));
  current = {
    close: () => (readers.delete(io.input), rl.close()),
    next: () => (queue.length ? Promise.resolve(queue.shift()!) : new Promise((resolve) => waiters.push(resolve))),
  };
  readers.set(io.input, current);
  return current;
}

/** Releases the input stream (end of the prompts: lets the process exit). */
export function closePrompts(io: PromptIO): void {
  readers.get(io.input)?.close();
}

/** Reads one line (trimmed). */
async function line(question: string, io: PromptIO): Promise<string> {
  io.output.write(question);
  const answer = await reader(io).next();
  if (answer === null) throw new PromptCancelled();
  return answer.trim();
}

/** Free text; `validate` returns an error message to ask again. */
export async function text(io: PromptIO, question: string, fallback: string, validate?: (value: string) => string | undefined): Promise<string> {
  for (;;) {
    const value = (await line(`${color("cyan", "?", io)} ${question} ${color("dim", `(${fallback})`, io)} `, io)) || fallback;
    const error = validate?.(value);
    if (!error) return value;
    io.output.write(`  ${color("red", error, io)}\n`);
  }
}

/** Yes / no. */
export async function confirm(io: PromptIO, question: string, fallback: boolean): Promise<boolean> {
  for (;;) {
    const value = (await line(`${color("cyan", "?", io)} ${question} ${color("dim", fallback ? "(Y/n)" : "(y/N)", io)} `, io)).toLowerCase();
    if (!value) return fallback;
    if (value === "y" || value === "yes") return true;
    if (value === "n" || value === "no") return false;
  }
}

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** One of `choices`: arrow keys + Enter on a TTY, else a number (or a value) typed on a line. */
export async function select<T extends string>(io: PromptIO, question: string, choices: readonly Choice<T>[], initial = 0): Promise<T> {
  const { input, output } = io;
  if (!input.isTTY || !input.setRawMode) {
    output.write(`${color("cyan", "?", io)} ${question}\n`);
    choices.forEach((choice, i) => output.write(`  ${i + 1}. ${choice.label}${choice.hint ? color("dim", ` - ${choice.hint}`, io) : ""}\n`));
    for (;;) {
      const value = await line(`  ${color("dim", `number (${initial + 1})`, io)} `, io);
      if (!value) return choices[initial]!.value;
      const byValue = choices.find((choice) => choice.value === value);
      if (byValue) return byValue.value;
      const index = Number(value) - 1;
      if (Number.isInteger(index) && choices[index]) return choices[index].value;
    }
  }
  let index = initial;
  const render = (first: boolean) => {
    if (!first) output.write(`\x1b[${choices.length}A`);
    choices.forEach((choice, i) => {
      const active = i === index;
      const label = active ? color(["cyan", "bold"], `> ${choice.label}`, io) : `  ${choice.label}`;
      output.write(`\x1b[2K${label}${choice.hint ? color("dim", ` - ${choice.hint}`, io) : ""}\n`);
    });
  };
  // Raw keypresses: the line reader must not consume them.
  closePrompts(io);
  output.write(`${color("cyan", "?", io)} ${question} ${color("dim", "(arrow keys, Enter)", io)}\n`);
  render(true);
  emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  try {
    return await new Promise<T>((resolve, reject) => {
      const onKey = (_: string, key: { name?: string; ctrl?: boolean } = {}) => {
        if (key.ctrl && (key.name === "c" || key.name === "d")) return done(() => reject(new PromptCancelled()));
        if (key.name === "up" || key.name === "k") index = (index - 1 + choices.length) % choices.length;
        else if (key.name === "down" || key.name === "j") index = (index + 1) % choices.length;
        else if (key.name === "return" || key.name === "enter") return done(() => resolve(choices[index]!.value));
        else return;
        render(false);
      };
      const done = (settle: () => void) => {
        input.off("keypress", onKey);
        settle();
      };
      input.on("keypress", onKey);
    });
  } finally {
    input.setRawMode(false);
    input.pause();
  }
}
