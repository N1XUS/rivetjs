// T7: a page importing a constant from a plain `.ts` endpoint route: the browser build keeps the
// constant and drops the endpoint's handlers and the server-only module they import.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { withNodeEnv } from "./vite-env.ts";

const repo = fileURLToPath(new URL("../../../", import.meta.url));

test.each([false, true])("browser build: endpoint handlers stay out of client code and source maps (sourcemap=%s)", async (sourcemap) => {
  mkdirSync(join(repo, ".artifacts"), { recursive: true });
  const root = mkdtempSync(join(repo, ".artifacts", "router-endpoint-split-"));
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ name: "endpoint-split", type: "module" }),
    "vite.config.ts": `import { rivetRouter } from "@rivetjs/router/vite";\nexport default { plugins: [rivetRouter()], logLevel: "silent" };\n`,
    "src/document.ts": `export default () => ({ start: "<!doctype html><div id=app>", end: "</div>" });\n`,
    "src/secret.server.ts": `export const secret = () => "endpoint-split-secret-token";\n`,
    "src/routes/api/items.ts": `import { secret } from "../../secret.server.ts";\nimport { onGet } from "@rivetjs/router";\nexport const PAGE_SIZE = 4242;\nexport const GET = onGet(() => {\n  return new Response(secret() + "endpoint-handler-marker");\n});\n`,
    // Interactive (a resume boundary): a static page ships no client JS on the derived model.
    "src/routes/index.tsx": `import { signal } from "@rivetjs/reactivity";\nimport { PAGE_SIZE } from "./api/items.ts";\nexport default function Home() {\n  const n = signal(0);\n  return <button onClick={() => n.set(n() + PAGE_SIZE)}>{n()}</button>;\n}\n`,
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  try {
    await withNodeEnv("production", () => build({ root, configFile: join(root, "vite.config.ts"), logLevel: "silent", build: { sourcemap } }));
    const out = join(root, "dist/client");
    const files = readdirSync(out, { recursive: true, withFileTypes: true });
    if (sourcemap)
      assert.ok(
        files.some((e) => e.isFile() && e.name.endsWith(".js.map")),
        "the source-map canary must exercise emitted maps",
      );
    const client = files
      .filter((e) => e.isFile() && (e.name.endsWith(".js") || e.name.endsWith(".js.map")))
      .map((e) => readFileSync(join(e.parentPath, e.name), "utf8"))
      .join("\n");
    assert.match(client, /4242/, "the shared constant stays");
    for (const banned of ["endpoint-split-secret-token", "endpoint-handler-marker"]) assert.ok(!client.includes(banned), `${banned} in the client build`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
