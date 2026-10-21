import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// PPR-T01 T0 harness app (`../bench.ts`): the rivet-dynamic article page (lane `src/content.ts` + `Markdown`) in server mode,
// in three shapes — `/full/…` (signed in: session-cookie loader + user menu), `/stub/…` (same page, the user menu = a
// constant placeholder of the same markup, no request read), `/hole/<slug>` (the user menu alone) — plus `/floor`.
export default defineConfig({
  plugins: [rivetRouter({ mode: "server" })],
  logLevel: "warn",
});
