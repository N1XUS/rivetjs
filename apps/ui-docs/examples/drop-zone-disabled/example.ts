import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DropZone: Disabled",
  summary: "isDisabled on the area: no drops, no paste, and the browse button is disabled too.",
  tags: ["drop-zone"],
  status: "experimental",
  frame: { height: 280 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#dz-disabled [data-slot=drop-zone-area]", "data-disabled", "true"],
    },
    {
      attr: ["#dz-disabled [data-slot=drop-zone-trigger]", "disabled", ""],
    },
  ],
});
