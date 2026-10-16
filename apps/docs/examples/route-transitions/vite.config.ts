import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

// #region demo
export default defineConfig({
  // `transitions: true` turns on animated route changes and pending state.
  plugins: [rivetRouter({ styles: ["src/styles.css"], transitions: true }), tailwindcss()],
});
// #endregion
