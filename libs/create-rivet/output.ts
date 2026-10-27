// Standalone create-rivet presentation: no dependency on the framework/compiler packages.
import { styleText } from "node:util";

export interface TerminalStream {
  isTTY?: boolean;
  columns?: number;
  write(text: string): unknown;
}
export type TerminalEnv = Record<string, string | undefined>;

/** CI stays plain even when a wrapper sets FORCE_COLOR. NO_COLOR always wins. */
export function colorEnabled(stream: Pick<TerminalStream, "isTTY">, env: TerminalEnv = process.env): boolean {
  if (env.NO_COLOR !== undefined || (env.CI !== undefined && env.CI !== "false" && env.CI !== "0") || env.FORCE_COLOR === "0") return false;
  return env.FORCE_COLOR !== undefined || !!stream.isTTY;
}
export function paint(format: Parameters<typeof styleText>[0], text: string, stream: TerminalStream = process.stderr, env: TerminalEnv = process.env): string {
  return colorEnabled(stream, env) ? styleText(format, text, { validateStream: false }) : text;
}
export function debugEnabled(env: TerminalEnv = process.env): boolean {
  return (env.DEBUG ?? "").split(/[ ,]+/).some((part) => part === "rivet" || part === "rivet:*" || part === "*");
}

/** Conservative edit-distance suggestion; never guesses an unrelated command. */
export function suggestion(value: string, choices: readonly string[]): string {
  const distance = (a: string, b: string) => {
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1]! + 1, row[j]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      row = next;
    }
    return row[b.length]!;
  };
  const best = choices.map((choice) => ({ choice, score: distance(value, choice) })).sort((a, b) => a.score - b.score)[0];
  return best && best.score <= Math.min(3, Math.max(1, Math.floor(value.length / 3))) ? ` Did you mean ${best.choice}?` : "";
}
export function summary(errors: number, warnings: number): string {
  return `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`;
}

/** One updating line on a terminal; periodic plain lines in pipes/CI. Always stop in a finally block. */
export function progress(
  label: string,
  {
    stream = process.stderr,
    env = process.env,
    quiet = false,
    interval = 5000,
  }: {
    stream?: TerminalStream;
    env?: TerminalEnv;
    quiet?: boolean;
    interval?: number;
  } = {},
) {
  const start = performance.now();
  const tty = !!stream.isTTY && !env.CI && env.NO_COLOR === undefined;
  let detail = "",
    closed = false;
  const elapsed = () => `${((performance.now() - start) / 1000).toFixed(1)} s`;
  const write = () => {
    if (quiet || closed) return;
    const line = `${label}${detail ? ": " + detail : ""} (${elapsed()})`.replace(/[\r\n\x1b]/g, " ");
    stream.write(tty ? `\r\x1b[2K${line.slice(0, Math.max(10, (stream.columns ?? 80) - 1))}` : line + "\n");
  };
  write();
  const timer = quiet ? undefined : setInterval(write, tty ? 100 : interval);
  timer?.unref();
  return {
    update(value: string) {
      detail = value;
    },
    stop(message?: string) {
      if (closed) return;
      closed = true;
      if (timer) clearInterval(timer);
      if (!quiet) {
        if (tty) stream.write("\r\x1b[2K");
        if (message) stream.write(`${message} in ${elapsed()}\n`);
      }
    },
  };
}
