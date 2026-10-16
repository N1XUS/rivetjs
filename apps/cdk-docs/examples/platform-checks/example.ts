import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Platform checks",
  summary: "Every @rivetjs/cdk/platform check, read in a click handler: browser and OS probes, CSS feature support, Angular CDK Platform flags.",
  tags: ["cdk", "platform", "basic"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#empty", "Not detected yet"] },
    { click: "#detect" },
    { absent: "#empty" },
    { expect: ['[data-check="isChrome()"] td', "true"] },
    { expect: ['[data-check="isFirefox()"] td', "false"] },
    { expect: ['[data-check="isIOS()"] td', "false"] },
    { expect: ['[data-check="getPlatform().BLINK"] td', "true"] },
    { expect: ['[data-check="getPlatform().isBrowser"] td', "true"] },
    { expect: ['[data-check="supports(\\"field-sizing\\")"] td', "true"] },
    { expect: ['[data-check="getSupportedInputTypes().has(\\"date\\")"] td', "true"] },
  ],
});
