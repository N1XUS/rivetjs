// Vitest wiring for a story app's resume fuzz (`cdk-resume-fuzz` / `ui-resume-fuzz`): one test per route, failing on
// every finding that is not pinned; one `test.fails` per pin (it starts passing — so the suite fails — once the finding
// is gone: drop the pin then).
import { appendFileSync } from "node:fs";
import { afterAll, beforeAll, test } from "vitest";
import type { Browser } from "playwright";
import { formatFinding, fuzzRoute, selectRoutes, type FindingKind, type FuzzFinding, type FuzzOptions, type FuzzRouteResult } from "./resume-fuzz.ts";

/** A known finding: route + kind + a substring / pattern of what differs, with the owner that fixes it. */
export interface FuzzPin {
  route: string;
  kind: FindingKind;
  /** Matched against the finding's `diff` (the differing tokens / lines only, never the surrounding context). */
  match: string | RegExp;
  /** 1-based step the finding is seen after (0: at load); default any step. */
  step?: number;
  owner: string;
  note: string;
  /** An accepted or non-deterministic difference: filtered, never a `test.fails`. */
  design?: boolean;
}

export interface FuzzSuiteOptions {
  /** Story routes (all of the app; `RIVET_FUZZ_ROUTES` / `RIVET_FUZZ_SHARD` select from them). */
  routes: string[];
  /** Starts the story server + browser (the app's `stories()` harness). */
  start(): Promise<{ origin: string; browser: Browser; close(): Promise<void> }>;
  /** Vitest project name (for the rerun command in repro logs), e.g. `ui-resume-fuzz`. */
  project?: string;
  pins?: FuzzPin[];
  /** Per-route options (`skip` selectors, `from`, …). */
  options?: (route: string) => Partial<FuzzOptions>;
}

/** Whether `pin` covers `finding` (route, kind, optional 1-based step, `match` against the finding's `diff`). */
export const pinMatches = (pin: FuzzPin, finding: FuzzFinding): boolean =>
  pin.route === finding.route &&
  pin.kind === finding.kind &&
  (pin.step === undefined || pin.step === finding.step + 1) &&
  (typeof pin.match === "string" ? finding.diff.includes(pin.match) : pin.match.test(finding.diff));

/** Findings no pin covers (each fails its route's test). */
export const openFindings = (findings: FuzzFinding[], pins: FuzzPin[]): FuzzFinding[] =>
  findings.filter((finding) => !pins.some((pin) => pinMatches(pin, finding)));

/** An open pin's `test.fails` body: throws while the finding is still there, so a fixed finding (or a match that no longer hits) fails the suite. */
export function checkPin(pin: FuzzPin, result: FuzzRouteResult | undefined): void {
  if (!result) throw new Error("route not run");
  if (result.findings.some((finding) => pinMatches(pin, finding))) throw new Error("still found");
}

/** Register the suite in the calling test file. */
export function fuzzSuite(suite: FuzzSuiteOptions): void {
  const routes = selectRoutes(suite.routes);
  const pins = (suite.pins ?? []).filter((pin) => routes.includes(pin.route));
  // Pins are recorded with the default seed and step cap: another plan makes them meaningless (not "fixed").
  const custom = Boolean(process.env.RIVET_FUZZ_STEPS || process.env.RIVET_FUZZ_SEED);
  const out = process.env.RIVET_FUZZ_OUT;
  const results = new Map<string, FuzzRouteResult>();
  let app: Awaited<ReturnType<FuzzSuiteOptions["start"]>> | undefined;
  beforeAll(async () => {
    app = await suite.start();
  });
  afterAll(async () => {
    await app?.close();
    const steps = [...results.values()].reduce((n, r) => n + r.steps, 0);
    const elements = [...results.values()].reduce((n, r) => n + r.elements, 0);
    const findings = [...results.values()].reduce((n, r) => n + r.findings.length, 0);
    if (process.env.RIVET_FUZZ_LOG)
      console.log(`resume fuzz: ${results.size} routes, ${elements} elements, ${steps} steps, ${findings} findings (${pins.length} pinned)`);
  });
  for (const route of routes)
    test(route, async () => {
      const result = await fuzzRoute(route, { origin: app!.origin, browser: app!.browser, ...suite.options?.(route) });
      results.set(route, result);
      if (out) appendFileSync(out, JSON.stringify(result) + "\n");
      if (process.env.RIVET_FUZZ_LOG) for (const f of result.findings) console.log(formatFinding(f, suite.project));
      const open = openFindings(result.findings, pins);
      if (open.length) throw new Error(open.map((f) => formatFinding(f, suite.project)).join("\n\n"));
      // Lost coverage stays visible: a pinned structural difference ends the DOM comparison for the rest of the route.
      if (result.compareEnded !== undefined)
        console.log(
          `${route}: DOM comparison ended ${result.compareEnded < 0 ? "at load" : "at step " + (result.compareEnded + 1)} of ${result.steps} (pinned structural difference); later steps checked errors / reloads only`,
        );
    });
  for (const pin of pins.filter((p) => !p.design))
    (custom ? test.skip : test.fails)(`pin ${pin.route} ${pin.kind} (${pin.owner}): ${pin.note}`, () => checkPin(pin, results.get(pin.route)));
}
