import { renderToString } from "solid-js/web";
import { app } from "./solid.jsx";
import { serverBench } from "./harness.js";
globalThis.ctxBench = serverBench(app, (factory) => renderToString(factory));
