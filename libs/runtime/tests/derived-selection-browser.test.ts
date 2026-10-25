import { test, expect } from "vitest";
import { mkdir, mkdtemp, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { rivet } from "../../compiler/vite.ts";
import { withPage } from "./resume/harness.ts";

async function fixture() {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/selection-"));
  const source = `import {signal} from '@rivetjs/reactivity';export default function Input(){const value=signal("A\\0B");return <div><input id="input" model:value={value}/><p id="value">{value()}</p></div>}`;
  await writeFile(resolve(root, "package.json"), '{"type":"module"}');
  await writeFile(resolve(root, "page.tsx"), source);
  await writeFile(resolve(root, "entry.ts"), 'export {default} from "./page.tsx";export {mount} from "@rivetjs/runtime/dom";');
  await writeFile(
    resolve(root, "server.ts"),
    `import Input from './page.tsx';import {renderDocument} from '@rivetjs/router/server';export const render=async(manifest)=>(await renderDocument(()=>Input(),{head:undefined,nonce:undefined,url:new URL('http://x/'),status:200,styles:[]},{manifest,document:()=>({start:'<!doctype html><html><head></head><body>',end:'</body></html>'})},{status:200,headers:new Headers()})).text();`,
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
  const files: Record<string, string> = { "/": await render(manifest) };
  for (const file of await readdir(resolve(root, "client"), { recursive: true }))
    if (file.endsWith(".js")) files["/" + file] = await readFile(resolve(root, "client", file), "utf8");
  const viteManifest = JSON.parse(await readFile(resolve(root, "client/.vite/manifest.json"), "utf8"));
  return { root, files, entryUrl: "/" + viteManifest["entry.ts"].file };
}
for (const dirty of [false, true])
  test(`ordinary retained model adoption preserves ${dirty ? "dirty" : "pristine parser-normalized"} focused selection`, async () => {
    const app = await fixture();
    let release!: () => void;
    const pending = new Promise<void>((r) => (release = r));
    try {
      await withPage(
        app.files,
        async (page) => {
          await page.goto("http://rivet.test/", { waitUntil: "domcontentloaded" });
          await page.evaluate((dirty) => {
            const input = document.querySelector("#input") as HTMLInputElement;
            (window as any).retained = input;
            input.focus();
            if (dirty) input.value = "Next";
            input.setSelectionRange(dirty ? 1 : 0, dirty ? 2 : 3, "backward");
            if (dirty) input.dispatchEvent(new InputEvent("input", { bubbles: true }));
          }, dirty);
          release();
          await page.waitForFunction((dirty) => (document.querySelector("#input") as HTMLInputElement).value === (dirty ? "Next" : "A\0B"), dirty);
          const state = await page.evaluate(() => {
            const input = document.querySelector("#input") as HTMLInputElement;
            return {
              same: input === (window as any).retained,
              focus: document.activeElement === input,
              value: input.value,
              start: input.selectionStart,
              end: input.selectionEnd,
              direction: input.selectionDirection,
            };
          });
          expect(state).toEqual({ same: true, focus: true, value: dirty ? "Next" : "A\0B", start: dirty ? 1 : 0, end: dirty ? 2 : 3, direction: "backward" });
          if (!dirty) {
            await page.keyboard.insertText("Next");
            expect(await page.inputValue("#input")).toBe("Next");
            expect(await page.textContent("#value")).toBe("Next");
            await page.evaluate(async (url) => {
              const module = await import(url),
                host = document.createElement("section");
              host.id = "fresh";
              document.body.append(host);
              module.mount(() => module.default(), host);
              const input = host.querySelector("input")!;
              input.focus();
              input.setSelectionRange(0, 3, "backward");
            }, app.entryUrl);
            await page.keyboard.insertText("Next");
            expect(await page.inputValue("#fresh input")).toBe("Next");
            expect(await page.textContent("#fresh p")).toBe("Next");
          }
        },
        {
          delays: Object.fromEntries(
            Object.keys(app.files)
              .filter((p) => p.endsWith(".js"))
              .map((p) => [p, pending]),
          ),
        },
      );
    } finally {
      release();
      await rm(app.root, { recursive: true, force: true });
    }
  });
