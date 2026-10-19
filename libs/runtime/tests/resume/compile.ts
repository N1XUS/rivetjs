// Compile resume fixtures for tests and import them without a bundler.
import * as compiler from "@rivetjs/compiler";
import type { Diagnostic } from "@rivetjs/compiler";

/** One extracted resume symbol (shape produced by the compiler's resume pass). */
export interface ResumeSymbol {
  name: string;
  id: string;
  kind: string;
  component: string;
  captures: string[];
  labels?: string[];
  scope: unknown;
  imports: { local: string; imported: string; from: string }[];
  locals: string[];
  source: string;
}
export interface CompileOptions {
  target?: "server" | "dom";
  filename?: string;
  resume?: { module: string };
}
export interface CompileResult {
  code: string;
  diagnostics: Diagnostic[];
  symbols: ResumeSymbol[];
}
/** Typed view of the compiler surface these tests use (resume options are not in its published types). */
interface ResumeCompiler {
  compile(source: string, options?: CompileOptions): CompileResult;
  _compileSymbolModule(symbols: ResumeSymbol[], from: string): string;
}
const typed = compiler as unknown as ResumeCompiler;
export const compileSymbolModule: ResumeCompiler["_compileSymbolModule"] = (symbols, from) => typed._compileSymbolModule(symbols, from);

const specifiers = [
  "@rivetjs/runtime/server-resume",
  "@rivetjs/runtime/server-derived",
  "@rivetjs/runtime/server",
  "@rivetjs/runtime/style",
  "@rivetjs/runtime/slot",
  "@rivetjs/runtime/resume-format",
  "@rivetjs/runtime/props",
  "@rivetjs/runtime/id",
  // Projection captures (`globalDOMProps(props)`) import the cdk helper from the symbol module.
  "@rivetjs/cdk/dom-props",
  "@rivetjs/reactivity/store",
  "@rivetjs/reactivity",
];
/** Compile for a target in resume mode; throw on diagnostics. */
export function compileResume(source: string, target: "server" | "dom", module = "src/fixture.tsx"): CompileResult {
  const result = typed.compile(source, { target, filename: "fixture.tsx", resume: { module } });
  if (result.diagnostics.length) throw new Error(result.diagnostics.map((d) => d.message).join("\n"));
  return result;
}
/** Import server-compiled code through a data URL with resolved runtime specifiers. */
export async function importServer<T = Record<string, unknown>>(code: string): Promise<T> {
  for (const specifier of specifiers)
    code = code
      .replaceAll(`"${specifier}"`, JSON.stringify(import.meta.resolve(specifier)))
      .replaceAll(`'${specifier}'`, JSON.stringify(import.meta.resolve(specifier)));
  return (await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"))) as T;
}
