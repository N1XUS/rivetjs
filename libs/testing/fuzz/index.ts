// `@rivetjs/testing/fuzz`: resume fuzz over a story app (Function Bridge T31). Driver `./resume-fuzz.ts`, in-page half `./page.ts`.
export { fuzzRoute, storyRoutes, selectRoutes, plan, diffLines, structuralDiff, formatFinding, rerunCommand } from "./resume-fuzz.ts";
export type { FuzzOptions, FuzzStep, FuzzFinding, FindingKind, FuzzRouteResult, Discovered } from "./resume-fuzz.ts";
export { fuzzSuite } from "./suite.ts";
export type { FuzzPin, FuzzSuiteOptions } from "./suite.ts";
