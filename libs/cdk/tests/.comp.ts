import { compile } from "@rivetjs/compiler";
import { readFileSync } from "node:fs";
const f = process.argv[2]!;
const r = compile(readFileSync(f, "utf8"), { target: (process.argv[3] ?? "server") as any, filename: f, resume: { module: "x/" + f.split("/").pop() }, sourcePackages: ["@rivetjs/cdk"] } as any);
console.log(r.diagnostics, r.code);
