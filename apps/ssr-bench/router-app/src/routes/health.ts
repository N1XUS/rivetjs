// Bench control endpoints (same shape as `server.ts`), served through the router's endpoint routes.
export function onGet() {
  return Response.json({
    status: "ready",
    framework: "rivet-router",
    version: "0.0.0-experimental",
    variant: "stream",
    implementation: "@rivetjs/router node adapter + file routes",
    outputMode: "streaming-router",
    runtime: (process.versions as Record<string, string | undefined>).bun
      ? `bun ${process.versions.bun}`
      : "Deno" in globalThis
        ? `deno ${(globalThis as unknown as { Deno: { version: { deno: string } } }).Deno.version.deno}`
        : `node ${process.version}`,
  });
}
