// Append a corpus case: `node libs/compiler/oracle/record.ts <source.tsx> '<compile options JSON>'`.
// Records the raw `compile` result with the current wasm (the case then guards that output); the
// line format matches `check.ts` (`tag` for Map / Set / undefined). Re-recording existing lines is a
// one-off (see CLAUDE.md), not this script.
import { appendFileSync, readFileSync } from "node:fs";
import { compile, type CompileOptions } from "../index.ts";

const tag = (_key: string, value: unknown) =>
  value instanceof Map ? { $map: [...value] } : value instanceof Set ? { $set: [...value] } : value === undefined ? { $undefined: 1 } : value;

const [file, optionsJson] = process.argv.slice(2);
if (!file) throw Error("usage: record.ts <source.tsx> '<compile options JSON>'");
const source = readFileSync(file, "utf8");
const options = JSON.parse(optionsJson ?? "{}") as CompileOptions;
const result = compile(source, options);
if (result.diagnostics.length) throw Error("refusing to record a case with diagnostics: " + JSON.stringify(result.diagnostics));
appendFileSync(new URL("./corpus.jsonl", import.meta.url), JSON.stringify({ kind: "compile", args: [source, options], result }, tag) + "\n");
console.log(`recorded ${file} (${result.code.length} B of code)`);
