import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { chromium } from "playwright";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPlaygroundServer } from "./server.ts";

interface AuditResult {
  path: string;
  repeat: number;
  scores: Record<string, number>;
  lighthouseVersion: string;
  userAgent: string;
  fetchTime: string;
  configSettings: unknown;
}

/** Audit production resumed home/detail pages on mobile defaults, retaining complete HTML and JSON evidence. */
export async function auditPlayground({ output = ".artifacts/playground/lighthouse", repeats = 3 } = {}) {
  if (!Number.isInteger(repeats) || repeats < 1) throw new TypeError("repeats must be a positive integer");
  await mkdir(output, { recursive: true });
  const directory = await mkdtemp(resolve(output, "run-"));
  const results: AuditResult[] = [];
  let server: Awaited<ReturnType<typeof createPlaygroundServer>> | undefined;
  try {
    server = await createPlaygroundServer({ port: 0 });
    for (const path of ["/", "/items/1"])
      for (let repeat = 1; repeat <= repeats; repeat++) {
        const chrome = await launch({
          chromePath: chromium.executablePath(),
          chromeFlags: ["--headless", "--disable-gpu"],
          handleSIGINT: true,
        });
        try {
          const result = await lighthouse(new URL(path, server.url).href, {
            port: chrome.port,
            output: ["json", "html"],
            logLevel: "error",
            onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
          });
          if (!result || result.lhr.runtimeError)
            throw Error(result?.lhr.runtimeError?.message ?? "No Lighthouse report");
          const stem = (path === "/" ? "home" : "detail") + "-" + repeat;
          await writeFile(resolve(directory, stem + ".json"), result.report[0]!);
          await writeFile(resolve(directory, stem + ".html"), result.report[1]!);
          const scores = Object.fromEntries(
            Object.entries(result.lhr.categories).map(([key, value]) => [key, value.score! * 100]),
          );
          results.push({
            path,
            repeat,
            scores,
            lighthouseVersion: result.lhr.lighthouseVersion,
            userAgent: result.lhr.userAgent,
            fetchTime: result.lhr.fetchTime,
            configSettings: result.lhr.configSettings,
          });
        } finally {
          await chrome.kill();
        }
      }
    await writeFile(
      resolve(directory, "summary.json"),
      JSON.stringify(
        {
          results,
          note: "Production example only; Lighthouse mobile defaults, fresh browser per trial. Not a universal framework score or SSR load-test comparison.",
        },
        null,
        2,
      ) + "\n",
    );
    return { directory, results };
  } finally {
    await server?.close();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(await auditPlayground(), null, 2));
