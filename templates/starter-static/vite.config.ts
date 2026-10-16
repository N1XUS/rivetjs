import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Pages in src/routes are rendered to HTML files at build time (`mode: "static"`).
// Route files and the components they import resume automatically (`resume.appModules`, default true).
export default defineConfig({
  plugins: [rivetRouter({ mode: "static", styles: ["src/styles.css"] }), tailwindcss()],
});
