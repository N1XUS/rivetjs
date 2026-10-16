// Ported from embla-carousel (packages/embla-carousel/src/__tests__/mocks/index.ts, v8.6.0), MIT, © David Jerleke.
// Changes: Jest globals from `@rivetjs/testing/jest`, module specifiers; imports `./dom.ts` first (happy-dom globals).
import "./dom.ts";
import "./matchMedia.mock.ts";
import "./intersectionObserver.mock.ts";
import "./resizeObserver.mock.ts";

export { mockTestElementDimensions, mockTestElements } from "./testElements.mock.ts";
export { setMatchingMediaQuery, resetMatchingMediaQuery } from "./matchMedia.mock.ts";
