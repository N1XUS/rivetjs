import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: Handle types",
  summary: "`type` picks the handle affordance: a `line`, a line with a `drag` grip, a line with a `pill`, or a standalone `handle` pill.",
  tags: ["resizable"],
  status: "experimental",
  frame: { height: 300, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#drag-handle [data-slot=resizable-handle-grip] svg" },
    { matches: "#pill-handle [data-slot=resizable-indicator][data-type=pill]" },
    { matches: "#handle-handle.resizable__handle--handle [data-slot=resizable-indicator]" },
    { absent: "#line-handle [data-slot=resizable-indicator]" },
    { press: ["#pill-handle", "ArrowLeft"] },
    { attr: ["#pill-handle", "aria-valuenow", "45"] },
  ],
});
