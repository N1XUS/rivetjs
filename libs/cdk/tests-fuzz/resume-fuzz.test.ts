// Resume fuzz over the cdk story app (Function Bridge T31, `@rivetjs/testing/fuzz`): every route resumed vs CSR, every
// interactive element driven, DOM compared after each step. Own build output (`STORIES_DIST`, default `dist-fuzz`) so a
// concurrent `cdk-components` run never races this build. Pins (known findings + owner): `./pins.ts`; the derived
// resume model (`RIVET_RESUME_MODEL=derived`, own build `dist-fuzz-derived`) has its own set, `./pins-derived.ts`.
import { fuzzSuite, storyRoutes } from "@rivetjs/testing/fuzz";
import { pins as serialized, routeOptions } from "./pins.ts";
import { pins as derived } from "./pins-derived.ts";

const isDerived = process.env.RIVET_RESUME_MODEL === "derived";
process.env.STORIES_DIST ??= isDerived ? "dist-fuzz-derived" : "dist-fuzz";
const pins = isDerived ? derived : serialized;
const { stories } = await import("../tests-components/harness.ts");

// Shell cache route (`/shell-loader`, rule `shell`): the store is primed before the run so its resumed document load is a
// hit (`RIVET_FUZZ_SHELL=hit`, default: two loads, the doorkeeper stores on the second), the fill (`miss`: one) or a
// plain render (`off`).
const prime = process.env.RIVET_FUZZ_SHELL ?? "hit";
const start = async () => {
  const app = await stories();
  const states: (string | null)[] = [];
  for (let i = 0; i < (prime === "hit" ? 2 : prime === "miss" ? 1 : 0); i++) {
    const response = await fetch(app.origin + "/shell-loader");
    states.push(response.headers.get("x-rivet-cache"));
    await response.text();
  }
  // hit: the second load filled the store; miss: the first only passed the doorkeeper (the resumed load fills).
  const want = prime === "hit" ? "null,SHELL-MISS" : prime === "miss" ? "null" : "";
  if (states.map(String).join() !== want) throw new Error(`RIVET_FUZZ_SHELL=${prime}: priming answered ${states.join()} (want ${want})`);
  return app;
};

fuzzSuite({
  project: "cdk-resume-fuzz",
  routes: storyRoutes(new URL("../tests-components/app/src/routes/", import.meta.url)),
  start,
  pins,
  options: routeOptions,
});
