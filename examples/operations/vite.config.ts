import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Pages render on the server for each request; `load(…)`, `actions(…)` and `guard(…)` exports in route files run there.
export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"] }), tailwindcss()],
});
