import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Vertical tabs",
  summary: 'orientation="vertical": the tablist stacks, ArrowDown and ArrowUp move (ArrowLeft / ArrowRight still work), aria-orientation is vertical.',
  tags: ["aria", "tabs", "orientation"],
  status: "experimental",
  frame: { height: 186, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#settings", "data-orientation", "vertical"] },
    { attr: ["#settings [role=tablist]", "aria-orientation", "vertical"] },
    { attr: ["#settings [role=tablist]", "data-rk", "ArrowDown ArrowUp ArrowLeft ArrowRight Home End Space Enter"] },
    { press: ["#settings-tab-profile", "ArrowDown"] },
    { focused: "#settings-tab-security" },
    { expect: ["#value", "Selected: security"] },
    { key: "ArrowDown" },
    { focused: "#settings-tab-billing" },
    { key: "ArrowDown" },
    { focused: "#settings-tab-profile" },
    { key: "ArrowUp" },
    { focused: "#settings-tab-billing" },
    { key: "ArrowRight" },
    { focused: "#settings-tab-profile" },
    { expect: ["#value", "Selected: profile"] },
    { expect: ["#settings-tabpanel-profile", "Profile settings."] },
  ],
});
