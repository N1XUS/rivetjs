// UWS-SPIKE lane entry (`dist/rivet-router-uws.mjs`, compose `rivet-router-uws` / `rivet-resume-uws`): the same
// file-routed build and app handler as `server.ts`, served by the experimental uWebSockets.js adapter
// (`libs/router/adapters/uws.ts`) instead of `node:http`. uWebSockets.js comes from `apps/ssr-bench/uws/`
// (installed only in `Dockerfile.uws`).
import { fileURLToPath } from "node:url";
import { loadBuild } from "../../../libs/router/adapters/build.ts";
import { serveUws } from "../../../libs/router/adapters/uws.ts";

const dist = fileURLToPath(new URL("./rivet-router/", import.meta.url));
const { handler, client } = await loadBuild(dist);
const serving = await serveUws({ handler, client, port: Number(process.env.PORT ?? 8080), host: "0.0.0.0" });
console.log(`SSR rivet-router-uws listening on ${serving.url}`);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.once(signal, () => {
    serving.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
