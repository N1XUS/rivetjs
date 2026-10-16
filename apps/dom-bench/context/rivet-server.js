import { renderToString } from "@rivetjs/runtime/server";
import { app } from "./rivet.jsx";
import { serverBench } from "./harness.js";
globalThis.ctxBench = serverBench(app, (factory) => renderToString(factory()));
