import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Pages render on the server per request; `*.server.ts` never reaches the browser build.
// `clientRouter: true`: `?new` / `?edit=` / `?delete=` links and form submits update the live page in place.
export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"], locales: ["en-US"], clientRouter: true }), tailwindcss()],
  logLevel: "warn",
});
