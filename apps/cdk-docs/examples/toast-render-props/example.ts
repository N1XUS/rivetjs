import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast render props and ToastList",
  summary:
    "Render props: ToastRegion class from visibleToasts, Toast children as a function of { toast, isFocusVisible }, and custom region content with a heading plus ToastList.",
  tags: ["toast", "slots", "render-props"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#trp-add" },
    { matches: ".rv-ToastRegion.count-1" },
    { expect: [".rv-ToastRegion h2", "Notifications"] },
    { matches: "ol.rv-ToastList > li > .rv-Toast" },
    { expect: [".rv-Toast", "Message 1"] },
    { click: "#trp-add" },
    { matches: ".rv-ToastRegion.count-2" },
    { key: "F6" },
    { key: "Tab" },
    { expect: [".rv-Toast[data-focus-visible]", "(keyboard focus)"] },
  ],
});
