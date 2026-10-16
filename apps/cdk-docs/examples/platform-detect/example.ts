import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "detectPlatform()",
  summary: "The pure function behind getPlatform(): Angular CDK Platform flags computed for a given user agent string.",
  tags: ["cdk", "platform", "options"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ['[data-flag="IOS"]', "IOS: true"] },
    { expect: ['[data-flag="SAFARI"]', "SAFARI: true"] },
    { click: "#android-chrome" },
    { attr: ["#android-chrome", "aria-pressed", "true"] },
    { expect: ['[data-flag="ANDROID"]', "ANDROID: true"] },
    { expect: ['[data-flag="BLINK"]', "BLINK: true"] },
    { expect: ['[data-flag="SAFARI"]', "SAFARI: false"] },
    { click: "#desktop-firefox" },
    { expect: ['[data-flag="FIREFOX"]', "FIREFOX: true"] },
    { expect: ['[data-flag="BLINK"]', "BLINK: false"] },
  ],
});
