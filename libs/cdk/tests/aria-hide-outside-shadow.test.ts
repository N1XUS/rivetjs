// Ported from React Aria ariaHideOutside.test.js, Apache-2.0, Copyright 2020 Adobe.
// Shared upstream shadow cases on happy-dom; see aria-hide-outside-shadow-cases.ts.
import { installDom } from "./install-dom.ts";
installDom();
const { shadowHideOutsideCases } = await import("./aria-hide-outside-shadow-cases.ts");
shadowHideOutsideCases();
