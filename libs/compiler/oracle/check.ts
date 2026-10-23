// Parity gate: run every recorded corpus case (oracle/corpus.jsonl, captured from the former
// TypeScript-API implementation) through the WebAssembly compiler and compare with the recorded
// result. Diagnostics must match exactly; emitted code is compared after esbuild whitespace/syntax
// minification of both sides (identifiers are never renamed, so structure differences remain).
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { transformSync, type Loader } from "esbuild";
import { compile, moduleFacts, type CompileOptions } from "../index.ts";

interface Case {
  kind: "compile" | "moduleFacts";
  args: unknown[];
  result: Record<string, unknown>;
}

const tag = (_key: string, value: unknown) =>
  value instanceof Map ? { $map: [...value] } : value instanceof Set ? { $set: [...value] } : value === undefined ? { $undefined: 1 } : value;
const untag = (_key: string, value: unknown) => (value && typeof value === "object" && "$undefined" in value ? undefined : value);

const normalize = (code: unknown, loader: Loader): string => {
  if (typeof code !== "string" || code === "") return String(code);
  try {
    return transformSync(code, { loader, minifyWhitespace: true, minifySyntax: true }).code;
  } catch (error) {
    return "<esbuild error> " + (error as Error).message;
  }
};

/** Normalize the emitted `code` (JS). */
function comparable(result: Record<string, unknown>): Record<string, unknown> {
  return { ...result, code: normalize(result.code, "js") };
}

function diff(expected: unknown, actual: unknown, path = "result"): string[] {
  if (isDeepStrictEqual(expected, actual)) return [];
  if (expected && actual && typeof expected === "object" && typeof actual === "object" && !Array.isArray(expected) === !Array.isArray(actual)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    return [...keys].flatMap((key) => diff((expected as Record<string, unknown>)[key], (actual as Record<string, unknown>)[key], `${path}.${key}`));
  }
  return [`  ${path}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`];
}

const corpus = new URL("./corpus.jsonl", import.meta.url);
const cases: Case[] = readFileSync(corpus, "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line, untag));
const only = process.argv[2] === undefined ? null : Number(process.argv[2]);
let failed = 0;
cases.forEach((c, n) => {
  if (only !== null && n !== only) return;
  let problems: string[];
  try {
    if (c.kind === "compile") {
      const [source, options] = c.args as [string, CompileOptions | undefined];
      const actual = comparable(compile(source, options) as unknown as Record<string, unknown>);
      problems = diff(comparable(c.result), actual);
    } else {
      const [source, filename] = c.args as [string, string];
      const actual = JSON.parse(JSON.stringify(moduleFacts(source, filename), tag), untag);
      problems = diff(c.result, actual);
    }
  } catch (error) {
    problems = ["  threw: " + ((error as Error).stack ?? String(error))];
  }
  if (problems.length) {
    failed++;
    const options = c.args[1];
    console.log(`✗ case ${n} (${c.kind} ${JSON.stringify(options)})\n${problems.join("\n")}`);
  }
});
const total = only === null ? cases.length : 1;
console.log(`${total - failed}/${total} corpus cases match`);
process.exit(failed ? 1 : 0);
