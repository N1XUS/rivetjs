import { render } from "solid-js/web";
import { app } from "./solid.jsx";
import { propsBench } from "./harness.js";
window.propsBench = propsBench(app, (factory, host) => render(factory, host));
