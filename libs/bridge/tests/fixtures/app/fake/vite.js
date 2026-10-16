// The fake framework's bridge entry (what `@rivetjs/bridge-react/vite` `react()` is for React): `*.fake.js` modules,
// a `@jsxImportSource fake` pragma, `include` / `exclude`; its "framework plugin" only marks the modules it owns.
import { fileURLToPath } from "node:url";
import { ownership } from "@rivetjs/bridge/vite";

const here = (file) => fileURLToPath(new URL(file, import.meta.url));
/** Modules the fake framework plugin saw (ownership filter checks). */
export const seen = new Set();

export function fake(options = {}) {
  const own = ownership({ name: "fake", suffixes: [".fake.js"], pragma: ["fake"], include: options.include, exclude: options.exclude });
  return {
    name: "fake",
    owns: own.owns,
    specifiers: own.specifiers,
    configure: own.configure,
    plugins: () => [
      {
        name: "fake-framework",
        transform(_code, id) {
          if (own.owns(id.split("?", 1)[0])) seen.add(id.split("?", 1)[0]);
          return null;
        },
      },
    ],
    server: here("./server.js"),
    client: here("./client.js"),
    wrappers: ["component"],
    ...(options.islands ? { islands: options.islands } : {}),
    dedupe: options.dedupe ?? [],
    optimize: options.optimize ?? [],
  };
}
