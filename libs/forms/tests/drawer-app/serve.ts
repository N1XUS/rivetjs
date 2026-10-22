// Live-test the drawer demo: `node libs/forms/tests/drawer-app/serve.ts` (production build + node
// adapter) or `--dev` (Vite dev server). PORT defaults to 4641.
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build, createServer } from "vite";
import { closeOnSignals, start } from "@rivetjs/router/node";

const root = fileURLToPath(new URL("./", import.meta.url));
const configFile = root + "vite.config.ts";
/** Build output: `dist/`; `RIVET_RESUME_MODEL=derived` (M6-PARITY) builds the derived resume model into `dist/derived/`. */
export const dist = root + (process.env.RIVET_RESUME_MODEL === "derived" ? "dist/derived" : "dist");

/** Client + server builds into `dist`. */
export async function buildApp(): Promise<void> {
  await rm(dist, { recursive: true, force: true });
  await build({ root, configFile, logLevel: "warn", build: { outDir: dist + "/client" } });
  await build({ root, configFile, logLevel: "warn", build: { ssr: true, outDir: dist + "/server" } });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 4641);
  if (process.argv.includes("--dev")) {
    const vite = await createServer({ root, configFile, server: { port, host: "127.0.0.1" } });
    await vite.listen();
    console.log(`Drawer demo (dev): ${vite.resolvedUrls!.local[0]}`);
  } else {
    await buildApp();
    const app = await start({ dist, port, host: "127.0.0.1" });
    closeOnSignals(app);
    console.log(`Drawer demo: ${app.url}`);
  }
}
