// Run by ../testing.test.ts with and without RIVET_TEST_TARGET=server.
import { renderToString } from "@rivetjs/runtime/testing/server";

console.log(await renderToString(() => <p>{1 + 1}</p>));
