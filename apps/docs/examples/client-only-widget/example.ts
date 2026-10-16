import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Client-only widget",
  summary: "clientOnly keeps a browser-only module off the server and loads it when the component first renders, here after a click.",
  tags: ["browser-only", "lazy"],
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/components/LocalInfo.tsx"],
  test: [{ expect: ["#show", "Show browser details"] }, { click: "#show" }, { expect: ["#widget", "Browser language:"] }],
});
