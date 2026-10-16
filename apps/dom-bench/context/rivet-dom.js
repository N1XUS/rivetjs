import { render } from "@rivetjs/runtime/dom";
import { app } from "./rivet.jsx";
import { domBench } from "./harness.js";
window.ctxBench = domBench(app, (factory, host) => render(factory, host));
