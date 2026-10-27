import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: Client-side routing",
  summary: "`navigate` on AppLayout routes every sidebar and navbar link (here into a signal); `isCurrent` follows the location.",
  tags: ["app-layout", "layout", "routing"],
  status: "experimental",
  frame: { height: 420, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#alr-team" },
    { expect: ["#alr-path", "/team"] },
    { expect: ["#alr-title", "Team"] },
    { attr: ["#alr-team", "aria-current", "page"] },
    { click: "#alr-billing" },
    { expect: ["#alr-title", "Billing"] },
  ],
});
