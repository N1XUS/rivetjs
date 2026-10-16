import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs from items",
  summary:
    "The items preset: data in, tab and panel slots out; every panel is server-rendered (inactive ones hidden and inert); a panel with a button is no tab stop.",
  tags: ["aria", "tabs", "slots"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#mail-tab-inbox", "Inbox12"] },
    { matches: "#mail-tab-inbox svg" },
    { expect: ["#count-drafts", "2"] },
    { matches: "#mail .rv-TabPanel[hidden][inert]" },
    { press: ["#mail-tab-inbox", "ArrowRight"] },
    { matches: "#mail-tab-drafts svg" },
    { absent: "#mail-tab-inbox svg" },
    { expect: ["#mail-tab-inbox", "Inbox12"] },
    // Tab goes from the tablist straight into the panel's button.
    { key: "Tab" },
    { focused: "#open-drafts" },
    { attr: ["#mail-tabpanel-drafts", "tabindex", null] },
    { click: "#mail-tab-sent" },
    { attr: ["#mail-tabpanel-sent", "tabindex", "0"] },
    { key: "Tab" },
    { focused: "#mail-tabpanel-sent" },
  ],
});
