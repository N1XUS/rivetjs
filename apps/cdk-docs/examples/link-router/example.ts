import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Links with RouterProvider",
  summary: "RouterProvider routes same-origin Link clicks through navigate (with routerOptions) and maps hrefs with useHref; new-tab links stay native.",
  tags: ["link", "router"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#rl-guide", "href", "/app/guide"] },
    { click: "#rl-guide" },
    { expect: ["#rl-log", 'navigate /guide {"scroll":false}'] },
    { attr: ["#rl-blank", "target", "_blank"] },
  ],
});
