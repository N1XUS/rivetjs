// Vitest browser-mode setup file (root `vitest.config.ts` `browser()` projects): the headless cursor guard
// (`headless-cursor.ts`) in the tester frame, so CI's virtual cursor at (0, 0) — where renders start — dispatches no
// pointer enter / over / move the test did not script.
import { guardOriginPointer } from "./headless-cursor.ts";

guardOriginPointer();
