import { render } from "@rivetjs/runtime/dom";
import { Page } from "./page.tsx";

// Dev (client-rendered): the islands are client-created (`@rivetjs/bridge/dom` `_island`).
render(() => <Page />, document.getElementById("app")!);
