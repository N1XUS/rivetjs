// Vitest setup file registered by `rivetTest()` (`cleanup: true`, the default): after every test,
// `cleanup()` from `@rivetjs/runtime/testing` unmounts what `render` mounted (overlays portaled to
// `document.body` included) and restarts the id counter, so test B never sees test A's DOM or ids.
import { afterEach } from "vitest";
import { cleanup } from "@rivetjs/runtime/testing";

afterEach(() => cleanup());
