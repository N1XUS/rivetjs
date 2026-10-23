// Import server-compiled test fixtures without a bundler.
const specifiers = [
  "@rivetjs/runtime/server-derived",
  "@rivetjs/runtime/server",
  "@rivetjs/runtime/style",
  "@rivetjs/runtime/slot",
  "@rivetjs/runtime/resume-format",
  "@rivetjs/runtime/props",
  "@rivetjs/runtime/id",
  "@rivetjs/reactivity/store",
  "@rivetjs/reactivity/track",
  "@rivetjs/reactivity",
];
/** Import server-compiled code through a data URL with resolved runtime specifiers. */
export async function importServer<T = Record<string, unknown>>(code: string): Promise<T> {
  for (const specifier of specifiers)
    code = code
      .replaceAll(`"${specifier}"`, JSON.stringify(import.meta.resolve(specifier)))
      .replaceAll(`'${specifier}'`, JSON.stringify(import.meta.resolve(specifier)));
  return (await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"))) as T;
}
