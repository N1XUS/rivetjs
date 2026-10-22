// Resume fuzz over the ui story app (Function Bridge T31, `@rivetjs/testing/fuzz`): every route resumed vs CSR, every
// interactive element driven, DOM compared after each step. Own build output (`STORIES_DIST`, default `dist-fuzz`) so a
// concurrent `ui-components` run never races this build. Pins (known findings + owner): `./pins.ts`.
import { fuzzSuite, storyRoutes } from "@rivetjs/testing/fuzz";
import { genVisual } from "../tests-components/app/gen-visual.ts";
import { pins, routeOptions } from "./pins.ts";

process.env.STORIES_DIST ??= "dist-fuzz";
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
