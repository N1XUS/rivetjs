// vite.config.ts: file routes + React islands. `react()` owns *.react.tsx / *.react.jsx files
// (and files with an `@jsxImportSource react` pragma); everything else is compiled by Rivet.
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { react } from "@rivetjs/bridge-react/vite";

export default defineConfig({
  plugins: [rivetRouter({ bridges: [react()], prefetch: "document" })],
});

// Without the file router, the compiler plugin takes the same list:
//   import { rivet } from "@rivetjs/compiler/vite";
//   plugins: [rivet({ bridges: [react()] })]
