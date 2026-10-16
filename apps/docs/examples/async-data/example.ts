import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Async data",
  summary: "An Async boundary loads data, shows a fallback while it waits, and loads again when a signal it reads changes.",
  tags: ["async"],
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#user", "Ada Lovelace"] },
    { click: "#next" },
    { expect: ["#user", "Grace Hopper"] },
    { click: "#next" },
    { expect: ["#user", "Alan Turing"] },
  ],
});
