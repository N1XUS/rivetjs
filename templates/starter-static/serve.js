// Preview the built site: serves dist/client like a static host (folders → index.html, 404.html).
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "@rivetjs/router/node";

const client = resolve("dist/client");
const page = (path) => readFile(resolve(client, "." + path)).catch(() => null);

const serving = await serve({
  client,
  port: Number(process.env.PORT ?? 4173),
  handler: async (request) => {
    const { pathname } = new URL(request.url);
    // Files are served before the handler; here only folders and missing paths arrive.
    if (!pathname.endsWith("/") && (await page(pathname + "/index.html"))) return Response.redirect(new URL(pathname + "/", request.url), 308);
    const html = (await page(pathname.replace(/\/?$/, "/") + "index.html")) ?? null;
    if (html) return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    return new Response((await page("/404.html")) ?? "Not found", { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  },
});
console.log(`Preview: ${serving.url}`);
