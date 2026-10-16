import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Auto-growing TextArea",
  summary:
    "A TextField with a TextArea part that grows with its content without JavaScript: autosizeProps({ native: true }) and text-field.css (CSS field-sizing).",
  tags: ["text-area", "autosize"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "textarea#grow.cdk-textarea-autosize.cdk-textarea-autosize-native" },
    { attr: ["#grow", "rows", "1"] },
    { name: ["#grow", "Comment"] },
    { fill: ["#grow", "one\ntwo\nthree\nfour"] },
  ],
});
