import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "<Dir>",
  summary: "Dir from @rivetjs/cdk/bidi-dir renders the dir attribute as given and provides the normalized direction to useDirection() below it.",
  tags: ["cdk", "bidi", "controlled", "slots"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#region", "dir", "rtl"] },
    { expect: ["#inside", "direction: rtl (dir attribute: rtl)"] },
    { expect: ["#outside", "direction: ltr"] },
    { click: "#set-ltr" },
    { attr: ["#region", "dir", "ltr"] },
    { expect: ["#inside", "direction: ltr (dir attribute: ltr)"] },
    { click: "#set-RTL" },
    { attr: ["#region", "dir", "RTL"] },
    { matches: 'section#region[dir="RTL"]' },
    { expect: ["#inside", "direction: rtl (dir attribute: RTL)"] },
    { click: "#set-rtl" },
    { expect: ["#inside", "direction: rtl (dir attribute: rtl)"] },
    { expect: ["#outside", "direction: ltr"] },
  ],
});
