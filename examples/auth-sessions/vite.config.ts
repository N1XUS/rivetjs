import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Pages render on the server per request; `*.server.ts` (database, sessions, passwords) never reaches the browser build.
// No client router: a sign-in / sign-out changes what every page shows, so a successful submit loads the next document.
export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"], locales: ["en-US"] }), tailwindcss()],
  logLevel: "warn",
});
