import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ clientRouter: true, styles: ["src/styles.css"], transitions: { pending: { delay: 100, minDuration: 200 } } })],
  logLevel: "warn",
});
