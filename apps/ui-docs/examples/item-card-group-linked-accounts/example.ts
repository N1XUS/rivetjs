import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCardGroup: Linked Accounts",
  summary: "Connected services with connect / disconnect actions under a section header.",
  tags: ["item-card-group"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      name: ["#icg-linked", "Linked accounts"],
    },
  ],
});
