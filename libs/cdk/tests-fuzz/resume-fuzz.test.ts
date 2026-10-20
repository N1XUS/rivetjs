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

fuzzSuite({
  project: "cdk-resume-fuzz",
  routes: storyRoutes(new URL("../tests-components/app/src/routes/", import.meta.url)),
  start: stories,
  pins,
  options: routeOptions,
});
