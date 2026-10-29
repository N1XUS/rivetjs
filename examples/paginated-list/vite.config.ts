import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Pages render on the server per request (the loader reads each request's URL); `*.server.ts` never reaches the browser build.
// `clientRouter: true`: links to this page with other search parameters update it in place (the page is `live`).
export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"], locales: ["en-US"], clientRouter: true }), tailwindcss()],
  logLevel: "warn",
});
