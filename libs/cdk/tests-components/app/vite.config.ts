import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// aria story app (file routes, resumed): one page per component, used by the browser tests.
export default defineConfig({
  plugins: [
    rivetRouter({
      clientRouter: true,
      styles: ["src/styles.css"],
      // Shell cache stories (PPR-T23 / T6 / T57): stored shell + live hole; `/shell-loader` H-holes, `/shell-replay` replays,
      // `/shell-provider` replays (its hole writes a signal an ancestor provides).
      routeRules: {
        "/shell-loader": { shell: { maxAge: 3600 } },
        "/shell-replay": { shell: { maxAge: 3600 } },
        "/shell-provider": { shell: { maxAge: 3600 } },
      },
    }),
  ],
  logLevel: "warn",
});
