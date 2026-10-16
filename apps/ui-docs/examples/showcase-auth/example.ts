import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Showcase: Sign in",
  summary:
    "Sign in and sign up on one screen: a mode Segment, validated email and password fields with a show / hide toggle, a password strength meter, terms, a reset-link flow and a one-time code step. Nothing is sent anywhere.",
  tags: ["showcase", "form", "input-group", "input-otp", "meter", "segment", "checkbox"],
  status: "experimental",
  frame: { height: 760 },
  show: ["src/routes/index.tsx", "src/components/aurora-canvas.tsx", "src/components/aurora.ts", "src/styles.css"],
  test: [
    { expect: ["#auth-title", "Welcome back"] },
    { click: "#auth-mode [role=radio]:last-child" },
    { expect: ["#auth-title", "Create your shop"] },
    { fill: ["#signup-name", "Mira Okonkwo"] },
    { fill: ["#signup-email", "mira@example.com"] },
    { fill: ["#signup-password", "short"] },
    { expect: ["#strength", "Too weak"] },
    { fill: ["#signup-password", "Trail-runner-42"] },
    { expect: ["#strength", "Strong"] },
    { click: "[data-slot=checkbox]:has(#signup-terms) [data-slot=checkbox-content]" },
    { click: "#signup-submit" },
    { fill: ["[data-slot=input-otp]", "204318"] },
    { expect: ["#auth-done", "Welcome, Mira Okonkwo"] },
  ],
});
