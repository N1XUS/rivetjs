import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Form in a drawer",
  summary: "A live page: the drawer's form posts to an action, the list and the layout update in place, and the drawer stays open on errors and closes on success. Works without JavaScript too.",
  tags: ["forms", "actions", "overlays"],
  status: "experimental",
  mode: "server",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/routes/_layout.tsx", "src/forms/customer.ts"],
  test: [
    { expect: ["#customers", "Ada Lovelace"] },
    { click: "#clicks" },
    { expect: ["#clicks", "Clicked 1"] },
    { click: "#new" },
    { fill: ["#customer-name", "Ada Again"] },
    { fill: ["#customer-email", "ada@example.com"] },
    { click: "#save" },
    { expect: ["#customer-email-error", "already a customer"] },
    { fill: ["#customer-email", "ada.again@example.com"] },
    { click: "#save" },
    { expect: ["#customers", "Ada Again"] },
    { expect: ["#total", "3"] },
    { expect: ["#clicks", "Clicked 1"] },
  ],
});
