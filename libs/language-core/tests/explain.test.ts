// Diagnostic explanations (explain.json): one per registered code, and every Avoid / Prefer pair does what it says.
import { describe, expect, it } from "vitest";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import { CODES } from "@rivetjs/compiler/codes";
import { explainCode, explainedCodes, explanationMarkdown } from "../explain.ts";
import table from "../explain.json" with { type: "json" };

/** Codes whose pair needs compile options (resume module, server exports, scoped styles). */
const RESUME = new Set([
  "RV1103",
  "RV2001",
  "RV2002",
  "RV2003",
  "RV2005",
  "RV2006",
  "RV2007",
  "RV2008",
  "RV2011",
  "RV2012",
  "RV2013",
  "RV2014",
  "RV2015",
  "RV2016",
  "RV2102",
  "RV2105",
  "RV2106",
  "RV3009",
]);
/** Codes of the derived resume model (M2): the pair compiles with `resume: { module, model: "derived" }`; skipped on a wasm build without it. */
const DERIVED = new Set(["RV2103", "RV2104"]);
const SERVER_EXPORTS = new Set(["RV3007", "RV3008", "RV3009", "RV3010"]);
const STYLES = new Set(["RV5001", "RV5002"]);
/** Not reproducible by a single-file compile: i18n catalogs (RV4xxx), options / panics, type-aware and project checks, RV2009 (hash collision), RV2010 (Vite build: two installed copies), RV2145 / RV2146 / RV2148 (Vite build: bridge ownership, framework exports in browser code, Rivet runtime in a framework module), RV2149 (browser: framework island hydration recovery), RV2150 (server: Preact useId mask probe). */
const SKIP = /^RV4|^RV(7001|7101|7102|9001|2101|2009|2010|2145|2146|2148|2149|2150|3101)$/;

describe("explain", () => {
  it("covers every registered code, nothing else", () => {
    expect(table.codes.map((entry) => entry.code).sort()).toEqual(CODES.map((info) => info.code).sort());
    for (const explanation of explainedCodes()) {
      expect(explanation.fix.length, explanation.code).toBeGreaterThan(10);
      expect(explanation.messages.length, explanation.code).toBeGreaterThan(0);
    }
  });
  it("normalizes the code and renders Markdown", () => {
    expect(explainCode("rv1016")?.code).toBe("RV1016");
    expect(explainCode("1016")?.code).toBe("RV1016");
    expect(explainCode("RV0000")).toBeUndefined();
    const md = explanationMarkdown(explainCode("RV1016")!);
    expect(md).toContain("## RV1016:");
    expect(md).toContain("Fix: ");
  });
  it("Avoid triggers the code, Prefer compiles clean (both targets)", () => {
    const wrong: string[] = [];
    for (const explanation of explainedCodes()) {
      if (SKIP.test(explanation.code) || explanation.retired) continue;
      if (DERIVED.has(explanation.code) && !hasDerivedModel()) continue;
      const options = {
        filename: "src/a.tsx",
        ...(RESUME.has(explanation.code) ? { resume: { module: "src/a.tsx" } } : {}),
        ...(DERIVED.has(explanation.code) ? { resume: { module: "src/a.tsx", model: "derived" } } : {}),
        ...(SERVER_EXPORTS.has(explanation.code) ? { serverExports: true } : {}),
        ...(STYLES.has(explanation.code) ? { styles: { scope: "a" } } : {}),
      };
      const codes = (source: string) =>
        new Set(
          (["server", "dom"] as const).flatMap((target) => {
            // Compile warnings (RV2012 / RV2013 / RV2014, T10 fix 2) count too: `warnings`, the code is still emitted.
            const result = compile(source, { ...options, target } as never);
            return [...result.diagnostics, ...(result.warnings ?? [])].map((d) => d.code);
          }),
        );
      if (explanation.avoid && !codes(explanation.avoid).has(explanation.code)) wrong.push(`${explanation.code} avoid does not trigger it`);
      if (explanation.prefer && codes(explanation.prefer).size) wrong.push(`${explanation.code} prefer: ${[...codes(explanation.prefer)].join(", ")}`);
    }
    expect(wrong).toEqual([]);
  });
});
