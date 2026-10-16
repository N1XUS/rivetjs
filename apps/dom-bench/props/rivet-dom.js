import { render } from "@rivetjs/runtime/dom";
import { app } from "./rivet.jsx";
import { propsBench } from "./harness.js";
window.propsBench = propsBench(app, (factory, host) => render(factory, host));
