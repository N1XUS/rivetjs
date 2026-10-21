// Resume fuzz over the cdk story app (Function Bridge T31, `@rivetjs/testing/fuzz`): every route resumed vs CSR, every
// interactive element driven, DOM compared after each step. Own build output (`STORIES_DIST`, default `dist-fuzz`) so a
// concurrent `cdk-components` run never races this build. Pins (known findings + owner): `./pins.ts`; the derived
// resume model (`RIVET_RESUME_MODEL=derived`, own build `dist-fuzz-derived`) has its own set, `./pins-derived.ts`; the
// lazy rows + DOM-DATA build (`RIVET_LAZY_ROWS=on RIVET_LAZY_ROWS_HARNESS=1 RIVET_DOM_DATA=1`, own build `dist-fuzz-flip`,
// LAZY-FLIP) uses `./pins-flip.ts`.
import { fuzzSuite, storyRoutes } from "@rivetjs/testing/fuzz";
import { pins as serialized, routeOptions } from "./pins.ts";
import { pins as derived } from "./pins-derived.ts";
import { pins as flip } from "./pins-flip.ts";

const isDerived = process.env.RIVET_RESUME_MODEL === "derived";
const isFlip = !isDerived && process.env.RIVET_LAZY_ROWS === "on";
process.env.STORIES_DIST ??= isDerived ? "dist-fuzz-derived" : isFlip ? "dist-fuzz-flip" : "dist-fuzz";
const pins = isDerived ? derived : isFlip ? flip : serialized;
const { stories } = await import("../tests-components/harness.ts");

// Shell cache routes (rule `shell`): the store is primed before the run so their resumed document loads are hits
// (`RIVET_FUZZ_SHELL=hit`, default: two loads, the doorkeeper stores on the second), fills (`miss`: one) or plain renders
// (`off`). `/shell-loader` has an H-holes eligible hole (a hit renders no shell, PPR-T6), `/shell-replay` an ineligible one
// (a signal created in the shell: hits replay it), `/shell-provider` an eligible one that writes a signal an ancestor
// provides (PPR-T57: the fill sees the write, hits replay); a `hit` run checks each answers its path once before the fuzz.
// The derived model primes the same way (DERIVED-C3: the shell cache stores derived documents; same paths per route).
const prime = process.env.RIVET_FUZZ_SHELL ?? "hit";
const SHELL_ROUTES = { "/shell-loader": "SHELL-HIT", "/shell-replay": "SHELL-HIT-REPLAY", "/shell-provider": "SHELL-HIT-REPLAY" };
const start = async () => {
  const app = await stories();
  for (const [path, hit] of Object.entries(SHELL_ROUTES)) {
    const states: (string | null)[] = [];
    for (let i = 0; i < (prime === "hit" ? 3 : prime === "miss" ? 1 : 0); i++) {
      const response = await fetch(app.origin + path);
      states.push(response.headers.get("x-rivet-cache"));
      await response.text();
    }
    // hit: the second load filled the store, the third is a hit; miss: the first only passed the doorkeeper (the resumed load fills).
    const want = prime === "hit" ? "null,SHELL-MISS," + hit : prime === "miss" ? "null" : "";
    if (states.map(String).join() !== want) throw new Error(`RIVET_FUZZ_SHELL=${prime} ${path}: priming answered ${states.join()} (want ${want})`);
  }
  return app;
};

fuzzSuite({
  project: "cdk-resume-fuzz",
  routes: storyRoutes(new URL("../tests-components/app/src/routes/", import.meta.url)),
  start,
  pins,
  options: routeOptions,
});
