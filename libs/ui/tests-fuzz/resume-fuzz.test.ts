// Resume fuzz over the ui story app (Function Bridge T31, `@rivetjs/testing/fuzz`): every route resumed vs CSR, every
// interactive element driven, DOM compared after each step. Own build output (`STORIES_DIST`, default `dist-fuzz`) so a
// concurrent `ui-components` run never races this build. Pins (known findings + owner): `./pins.ts`.
import { fuzzSuite, storyRoutes } from "@rivetjs/testing/fuzz";
import { pins, routeOptions } from "./pins.ts";

process.env.STORIES_DIST ??= "dist-fuzz";
const { stories } = await import("../tests-components/harness.ts");

fuzzSuite({
  project: "ui-resume-fuzz",
  routes: storyRoutes(new URL("../tests-components/app/src/routes/", import.meta.url)),
  start: stories,
  pins,
  options: routeOptions,
});
