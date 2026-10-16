import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Portals and outlets",
  summary: "Angular CDK's imperative portals: a ComponentPortal, a TemplatePortal with a context and a DomPortal attached to a DomPortalOutlet, then detached.",
  tags: ["portal", "cdk", "angular"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/components/Outlet.tsx"],
  test: [
    { click: "#po-component" },
    { matches: "#po-outlet > .card" },
    { expect: ["#po-outlet", "Component: Ada"] },
    { expect: ["#po-status", "attached"] },
    { click: "#po-template" },
    { expect: ["#po-outlet", "Template: 3 items"] },
    { absent: "#po-outlet .card" },
    // A DomPortal moves an existing element in, and back on detach.
    { click: "#po-dom" },
    { matches: "#po-outlet > #po-note" },
    { absent: "#po-home > #po-note" },
    { click: "#po-detach" },
    { matches: "#po-home > #po-note" },
    { expect: ["#po-status", "empty"] },
  ],
});
