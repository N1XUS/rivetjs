import { mkdir, readFile, writeFile, cp } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { appSource, css, serverData, type RealLane } from "./fixture.ts";
import type { RealPage } from "./contract.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exec = promisify(execFile);
export const output = (lane: RealLane, page: RealPage) => resolve(root, "dist/real", lane, page);

/** The existing lane builder remains the only owner of compiler/toolchain options. */
export async function buildPage(lane: RealLane, page: RealPage) {
  const source = resolve(root, ".build/real-source", lane, page);
  await mkdir(resolve(source, "src"), { recursive: true });
  const put = (path: string, value: string) => writeFile(resolve(source, path), value);
  const data = JSON.stringify(serverData(page));
  const style = `<style>${css}</style>`;
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Northstar ${page}</title>${style}`;
  await put(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "preserve",
        jsxImportSource:
          lane === "rivet" ? "@rivetjs/runtime" : lane.startsWith("solid") ? "solid-js" : lane === "qwik" ? "@qwik.dev/core" : "@builder.io/qwik",
      },
    }),
  );
  if (lane === "rivet") {
    await put("page.tsx", appSource(lane, page));
    await put("root.tsx", 'import { App } from "./page.tsx"; export default function Root(props: {data:any[]}) {return <App data={props.data} />;}');
    await put(
      "server.tsx",
      `import { resumableToString } from "@rivetjs/runtime/server-resume"; import Root from "./root.tsx"; export async function render(manifest) { return ${JSON.stringify('<!doctype html><html lang="en"><head>' + head + "</head><body>")} + await resumableToString(() => <Root data={${data}} />, {manifest}) + "</body></html>"; }`,
    );
  } else if (lane.startsWith("solid")) {
    const stable = lane === "solid-stable";
    const web = stable ? "solid-js/web" : "@solidjs/web";
    await put("src/App.tsx", appSource(lane, page));
    await put("src/data.ts", `export async function loadData() { if (import.meta.env.SSR) return ${data}; return fetch('/data.json').then(r => r.json()); }`);
    await put(
      "src/Root.tsx",
      `import { ${stable ? "createResource, Suspense, Show" : "createMemo, Loading"} } from "solid-js"; import { App } from "./App"; import {loadData} from "./data"; export function Root() { ${stable ? "const [data] = createResource(loadData, {deferStream:true});" : "const data = createMemo(loadData, {deferStream:true});"} return <${stable ? "Suspense" : "Loading"}>${stable ? "<Show when={data()}>{(value) => <App data={value()} />}</Show>" : "<App data={data()!} />"}</${stable ? "Suspense" : "Loading"}>; }`,
    );
    await put("src/entry-client.tsx", `import {hydrate} from "${web}"; import {Root} from "./Root"; hydrate(() => <Root />, document.getElementById("app")!);`);
    await put(
      "src/entry-server.tsx",
      `import {generateHydrationScript, ${stable ? "renderToStringAsync" : "renderToStream"}} from "${web}"; import {Root} from "./Root"; export async function render() {return {head:generateHydrationScript(), html:await ${stable ? "renderToStringAsync" : "renderToStream"}(() => <Root />)};}`,
    );
    await put(
      "index.html",
      `<!doctype html><html lang="en"><head>${head}<!--ssr-head--></head><body><div id="app"><!--ssr-outlet--></div><script type="module" src="/src/entry-client.tsx"></script></body></html>`,
    );
  } else {
    const pkg = lane === "qwik" ? "@qwik.dev/core" : "@builder.io/qwik";
    await put("src/app.tsx", appSource(lane, page));
    await put(
      "src/root.tsx",
      `import {component$} from "${pkg}"; import {App} from "./app"; export const Root = component$((props: {data:any[]}) => <><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Northstar ${page}</title><style dangerouslySetInnerHTML={${JSON.stringify(css)}} /></head><body><App data={props.data}/></body></>);`,
    );
    await put(
      "src/entry.ssr.tsx",
      `import {renderToString} from "${pkg}/server"; import {Root} from "./root"; export default function render(opts) {return renderToString(<Root data={${data}}/>, {...opts, containerAttributes:{lang:"en"}});}`,
    );
    await cp(resolve(root, "lanes", lane, "render.ts"), resolve(source, "render.ts"));
  }
  const result = await exec(process.execPath, [fileURLToPath(import.meta.url), "--worker", lane, output(lane, page)], {
    env: { ...process.env, RESUME_BENCH_SOURCE: source },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.stderr) process.stderr.write(result.stderr);
  // A static server-data endpoint, also used by the Solid resource fallback. The same payload is
  // sent through every framework's SSR state transport; it is never imported by browser modules.
  await writeFile(resolve(output(lane, page), "data.json"), data);
  // Re-hash after the endpoint exists (the builder wrote an earlier manifest).
  const { writeBuildManifest } = await import("../provenance.ts");
  await writeBuildManifest(lane, output(lane, page));
}
if (process.argv[2] === "--worker") {
  const lane = process.argv[3]!;
  const { build } = await import(pathToFileURL(resolve(root, "lanes", lane, "build.ts")).href);
  await build(process.argv[4]!);
  process.exit(0);
}
