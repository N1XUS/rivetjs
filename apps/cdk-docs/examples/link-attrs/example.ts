import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Link attributes",
  summary: "Anchor attributes passed through a Link: target, rel, download, hrefLang, ping and referrerPolicy, plus an icon link named by aria-label.",
  tags: ["link", "options"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#la-ext", "target", "_blank"] },
    { attr: ["#la-ext", "rel", "noopener noreferrer"] },
    { attr: ["#la-file", "download", "report.csv"] },
    { attr: ["#la-any", "download", ""] },
    { attr: ["#la-de", "hreflang", "de"] },
    { attr: ["#la-de", "referrerpolicy", "no-referrer"] },
    { attr: ["#la-icon", "aria-label", "GitHub"] },
  ],
});
