// Install a happy-dom window as the global document for the testing-helper suites.
import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost/" });
Object.assign(globalThis, { window, document: window.document });
