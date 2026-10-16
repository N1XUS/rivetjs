import { test } from "vitest";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { contentClient } from "../services/content.client.ts";

test("browser REST service decodes DTOs and exposes HTTP/abort failures", async () => {
  const server = createServer((req, res) => {
    if (req.url!.includes("missing")) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    if (req.url!.includes("slow")) {
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ id: "performance", markdown: "# Benchmark article" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const service = contentClient(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    assert.deepEqual(await service.getArticle("performance"), { id: "performance", markdown: "# Benchmark article" });
    await assert.rejects(service.getArticle("missing"), /404/);
    await assert.rejects(service.getArticle("slow", { signal: AbortSignal.timeout(20) }));
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
