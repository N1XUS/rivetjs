import { render } from "solid-js/web";
import { app } from "./solid.jsx";
import { domBench } from "./harness.js";
window.ctxBench = domBench(app, (factory, host) => render(factory, host));
