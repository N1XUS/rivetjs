// Lighthouse runner (mobile preset = Lighthouse default config: Moto G Power emulation, simulated slow 4G + 4x CPU).
// Chromium = the repo's Playwright build (path passed in), launched headless by chrome-launcher.
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

export async function runLighthouse(url, chromePath) {
  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ["--headless=new", "--no-first-run", "--disable-extensions", "--use-mock-keychain", "--password-store=basic"],
  });
  try {
    const result = await lighthouse(url, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance"] });
    const a = result.lhr.audits;
    const num = (id) => a[id]?.numericValue ?? null;
    return {
      score: Math.round((result.lhr.categories.performance.score ?? 0) * 100),
      lcp: num("largest-contentful-paint"),
      fcp: num("first-contentful-paint"),
      tbt: num("total-blocking-time"),
      cls: num("cumulative-layout-shift"),
      si: num("speed-index"),
      domSize: num("dom-size") ?? num("dom-size-insight"),
      bytes: num("total-byte-weight"),
      warnings: result.lhr.runWarnings ?? [],
    };
  } finally {
    await chrome.kill();
  }
}
