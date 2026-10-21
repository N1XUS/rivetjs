// Resume fuzz over the ui story app (Function Bridge T31, `@rivetjs/testing/fuzz`): every route resumed vs CSR, every
// interactive element driven, DOM compared after each step. Own build output (`STORIES_DIST`, default `dist-fuzz`) so a
// concurrent `ui-components` run never races this build. Pins (known findings + owner): `./pins.ts`; the lazy rows +
// DOM-DATA build (`RIVET_LAZY_ROWS=on RIVET_LAZY_ROWS_HARNESS=1 RIVET_DOM_DATA=1`, own build `dist-fuzz-flip`, LAZY-FLIP)
// uses `./pins-flip.ts`.
import { fuzzSuite, storyRoutes } from "@rivetjs/testing/fuzz";
import { genVisual } from "../tests-components/app/gen-visual.ts";
import { pins as serialized, routeOptions } from "./pins.ts";
import { pins as flip } from "./pins-flip.ts";

const isFlip = process.env.RIVET_LAZY_ROWS === "on";
const pins = isFlip ? flip : serialized;
process.env.STORIES_DIST ??= isFlip ? "dist-fuzz-flip" : "dist-fuzz";
const { stories } = await import("../tests-components/harness.ts");
// The visual matrix routes (`routes/visual/*`, gitignored) are written before the routes are listed: the route set is the
// same on a fresh checkout (CI) as after an earlier build left them behind (`buildApp()` writes them again).
await genVisual();

fuzzSuite({
  project: "ui-resume-fuzz",
  routes: storyRoutes(new URL("../tests-components/app/src/routes/", import.meta.url)),
  start: stories,
  pins,
  options: routeOptions,
});
