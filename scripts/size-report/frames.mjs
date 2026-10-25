// Frame payload gate (ZERO Z2, 2026-10-25): real docs / ui-docs frame pages (one frames-only production build per
// site = `check-examples` without the Chromium checks), measured by `frame-metrics.mjs`, against the committed
// ceilings in `frames.json` (ratchet: any growth fails, reductions pass and print the `--update` hint). The ZERO
// acceptance targets (`TARGETS`) are printed as the remaining gap; they do not fail the gate.
//
//   node scripts/size-report/frames.mjs                 build + measure + print
//   node scripts/size-report/frames.mjs --check         also compare with frames.json (exit 1 on growth)
//   node scripts/size-report/frames.mjs --update        rewrite frames.json
//   --sites=docs,ui   --tolerance=<bytes>   --json=<out>
//
// Frames-only chunking is not full-site chunking (the full build shares chunks across ~1000 frames, so a frame's
// closure there is >= the one measured here); the gate tracks the frames-only numbers, which are deterministic.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFrames } from "../../libs/docs-kit/tools/check-examples.ts";
import { assertFrameCeilings, measureFrame, overTargets } from "./frame-metrics.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const baseline = resolve(root, "scripts/size-report/frames.json");

/** Small ZERO targets + large (>= 100 interactive elements) frames of each site. */
export const SITES = {
  docs: { app: "apps/docs", ids: ["tutorial-02", "resume-demo", "tutorial-03", "tutorial-04", "card-slots", "computed-total", "todo-list"] },
  ui: {
    app: "apps/ui-docs",
    ids: [
      "button-basic",
      "close-button-default",
      "prompt-suggestion-basic",
      "prompt-input-basic",
      "chain-of-thought-basic",
      "chat-attachment-basic",
      "data-grid-selection",
      "table-virtualization",
      "scheduler-views",
      "showcase-kanban",
    ],
  },
};
/** ZERO acceptance (ZERO-common.md "Goal / acceptance"): JS gz before input per frame. */
export const TARGETS = {
  "tutorial-02": { jsGz: 0 },
  "button-basic": { jsGz: 0 },
  "close-button-default": { jsGz: 0 },
  "resume-demo": { jsGz: 5120 },
  "tutorial-03": { jsGz: 5120 },
  "card-slots": { jsGz: 5120 },
  "prompt-suggestion-basic": { jsGz: 15360 },
  "chain-of-thought-basic": { jsGz: 15360 },
};

async function readAssets(client) {
  const assets = new Map();
  for (const file of await readdir(client, { recursive: true }))
    if (/\.m?js$/.test(file)) assets.set("/" + file.split("\\").join("/"), await readFile(resolve(client, file)));
  return assets;
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [k, v] = arg.replace(/^--/, "").split("=");
      return [k, v ?? true];
    }),
  );
  if (args.check && args.update) throw new Error("frames.mjs: --check and --update are exclusive");
  const sites = String(args.sites ?? Object.keys(SITES).join(",")).split(",");
  const measured = {};
  for (const name of sites) {
    const site = SITES[name];
    if (!site) throw new Error(`frames.mjs: unknown site ${name}`);
    const app = resolve(root, site.app);
    const frames = await buildFrames(app, site.ids, { dist: resolve(app, ".artifacts/frame-payload"), log: () => {} });
    const assets = await readAssets(frames.build.client);
    for (const id of site.ids) {
      const file = resolve(frames.build.client, `examples/${id}/frame/index.html`);
      if (!existsSync(file)) throw new Error(`frames.mjs: ${id}: no prerendered frame page`);
      const m = measureFrame(await readFile(file, "utf8"), assets);
      measured[id] = { site: name, ...m, urls: m.urls.map((u) => u.replace(/-[\w-]{8}\.js$/, ".js")) };
      console.log(
        `${id}: html ${m.html} B, holes ${m.holes}, records ${m.records}, state ${m.stateBytes} B, inline JS ${m.inlineJsBytes} B, ${m.files} JS files ${m.jsRaw} raw / ${m.jsGz} gz / ${m.jsBr} br`,
      );
    }
  }
  if (args.json) await writeFile(String(args.json), JSON.stringify(measured, null, 1) + "\n");
  const gap = overTargets(measured, TARGETS);
  console.log(gap.length ? `ZERO targets not met (informational):\n  ${gap.join("\n  ")}` : "ZERO targets: all met");
  if (args.update) {
    // A partial run (--sites) keeps the other site's ceilings.
    const old = existsSync(baseline) ? JSON.parse(await readFile(baseline, "utf8")) : {};
    const next = { ...Object.fromEntries(Object.entries(old).filter(([, v]) => !sites.includes(v.site))), ...measured };
    await writeFile(baseline, JSON.stringify(Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b))), null, 1) + "\n");
    console.log("frame payload: frames.json updated");
  } else if (args.check) {
    const ceilings = Object.fromEntries(Object.entries(JSON.parse(await readFile(baseline, "utf8"))).filter(([, v]) => sites.includes(v.site)));
    const better = assertFrameCeilings(measured, ceilings, { tolerance: Number(args.tolerance ?? 0) });
    console.log(`frame payload: within ceilings${better.length ? ` (smaller than baseline, run --update:\n  ${better.join("\n  ")})` : ""}`);
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
