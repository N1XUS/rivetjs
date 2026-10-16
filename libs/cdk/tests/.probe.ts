import { chromium } from "playwright";
import { start } from "@rivetjs/router/node";
const root = "/Users/denisseverin/Projects/claude-test/rivet/.claude/worktrees/cdk-virtual-dnd/libs/cdk/tests/app/";
const app = await start({ dist: root + "dist", port: 0, host: "127.0.0.1", onError: (e: unknown) => console.error("SERVER", e) });
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => console.log("CONSOLE", m.text()));
const res = await page.goto(app.url + "/" + (process.argv[2] ?? "scrolling"));
console.log("status", res?.status());
const out = await page.evaluate(process.argv[3] ?? "''");
console.log(typeof out === "string" ? out : JSON.stringify(out, null, 1));
if (process.argv[4]) { const r = await page.evaluate(process.argv[4]); console.log(JSON.stringify(r, null, 1)); }
await browser.close(); await app.close();
