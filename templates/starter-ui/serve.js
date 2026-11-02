// Preview the built site: serves dist/client like a static host (folders → index.html, 404.html).
import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { serve } from "@rivetjs/router/node";

const client = resolve("dist/client");
const html = { "content-type": "text/html; charset=utf-8" };
/** Absolute file for a decoded URL path inside dist/client, or null (outside it, or not a file). */
const file = async (path) => {
  const full = resolve(client, "." + path);
  if (full !== client && !full.startsWith(client + sep)) return null;
  return (await stat(full).catch(() => null))?.isFile() ? full : null;
};

const serving = await serve({
  client,
  port: Number(process.env.PORT || 4173),
  handler: async (request) => {
    const url = new URL(request.url);
    let pathname;
    try {
      // Percent-decoded, so pages with non-ASCII names resolve; a malformed escape is a bad request.
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    // Files are served before the handler; here only folders and missing paths arrive.
    if (!pathname.endsWith("/") && (await file(pathname + "/index.html"))) return Response.redirect(new URL(url.pathname + "/", url), 308);
    const page = await file(pathname.replace(/\/?$/, "/") + "index.html");
    if (page) return new Response(await readFile(page), { headers: html });
    const missing = await file("/404.html");
    return new Response(missing ? await readFile(missing) : "Not found", { status: 404, headers: html });
  },
});
console.log(`Preview: ${serving.url}`);
