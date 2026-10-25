import { test, expect } from "vitest";
import { mkdir, mkdtemp, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { rivet } from "../../compiler/vite.ts";
import { withPage } from "./resume/harness.ts";

async function fixture() {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/root-props-"));
  const source = `import {signal} from '@rivetjs/reactivity';export default function Root(props){const n=signal(0);return <div><button id="b" onClick={()=>n.set(n()+1)}>{n()}</button></div>}`;
  await writeFile(resolve(root, "package.json"), '{"type":"module"}');
  await writeFile(resolve(root, "page.tsx"), source);
  await writeFile(resolve(root, "entry.ts"), 'export {default} from "./page.tsx";export {mount} from "@rivetjs/runtime/dom";');
  await writeFile(
    resolve(root, "server.ts"),
    `import Input from './page.tsx';import {renderDocument} from '@rivetjs/router/server';export const render=async(manifest)=>(await renderDocument(()=>Input({cb:()=>1}),{head:undefined,nonce:undefined,url:new URL('http://x/'),status:200,styles:[]},{manifest,document:()=>({start:'<!doctype html><html><head></head><body>',end:'</body></html>'})},{status:200,headers:new Headers()})).text();`,
  );
  for (const server of [false, true])
    await build({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [rivet({ devtools: false, resume: { modules: ["page.tsx"], roots: ["page.tsx"] } })],
      build: server
        ? { outDir: "server", ssr: "server.ts" }
        : { outDir: "client", manifest: true, rollupOptions: { input: resolve(root, "entry.ts"), preserveEntrySignatures: "strict" } },
    });
  const manifest = JSON.parse(await readFile(resolve(root, "client/.vite/rivet-resume.json"), "utf8"));
  const { render } = await import(pathToFileURL(resolve(root, "server/server.js")).href);
  // The server half (BE-RENDER: which demoted roots get `BROWSER` 2048) is pending a compiler fact (a prop a handler reads);
  // the client half is tested by setting the bit on the root record.
  const html = (await render(manifest)) as string;
  const files: Record<string, string> = {
    "/": html.replace(/(<script type="rivet\/boundaries"[^>]*>)(.*?)(<\/script>)/s, (_, open: string, json: string, close: string) => {
      const tail = JSON.parse(json);
      tail.b[0][2] |= 2048;
      return open + JSON.stringify(tail) + close;
    }),
  };
  for (const file of await readdir(resolve(root, "client"), { recursive: true }))
    if (file.endsWith(".js")) files["/" + file] = await readFile(resolve(root, "client", file), "utf8");
  const viteManifest = JSON.parse(await readFile(resolve(root, "client/.vite/manifest.json"), "utf8"));
  return { root, files, entryUrl: "/" + viteManifest["entry.ts"].file };
}
// Ruling R-22 (ZERO): a ROOT boundary given props that are not data (a function here: the record is `DEMOTED`, its props not
// shipped) and marked `BROWSER` (2048) has no parent to adopt with — it renders in the browser instead of adopting silently with `{}`.
test("a root boundary with non-data props renders in the browser and stays interactive", async () => {
  const app = await fixture();
  try {
    await withPage(app.files, async (page) => {
      await page.goto("http://rivet.test/", { waitUntil: "domcontentloaded" });
      const tail = await page.evaluate(() => document.querySelector('script[type="rivet/boundaries"]')!.textContent!);
      expect(JSON.parse(tail).b[0][2] & (8 | 2048)).toBe(8 | 2048);
      await page.evaluate(() => ((window as any).server = document.querySelector("#b")));
      await page.click("#b");
      await page.waitForFunction(() => document.querySelector("#b")!.textContent === "1");
      expect(await page.evaluate(() => document.querySelector("#b") !== (window as any).server)).toBe(true);
      await page.click("#b");
      expect(await page.textContent("#b")).toBe("2");
    });
  } finally {
    await rm(app.root, { recursive: true, force: true });
  }
});
