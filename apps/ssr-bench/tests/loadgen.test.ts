import { test } from "vitest";
import assert from "node:assert/strict";
import { createServer as createHttpServer, type Server } from "node:http";
import { createServer as createNetServer, type AddressInfo } from "node:net";
import { runLoad } from "../loadgen/loadgen.ts";
import { fieldText, validateResponse } from "../loadgen/validate.ts";

const page = (rows: number, token = "trial", mutate = (html: string) => html): string => {
  let html = `<!doctype html><html><body><main data-token="${token}">`;
  for (let row = 0; row < rows; row++) {
    html += `<article data-row="${row}"><dl>`;
    for (let field = 0; field < 10; field++) html += `<dt>f</dt><dd><!--[-->${row * 100 + field}<!--]--></dd>`;
    html += "</dl></article>";
  }
  return mutate(html + "</main></body></html>") + "<!--complete-->";
};

async function listen(server: Server | ReturnType<typeof createNetServer>): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const close = (server: { close(cb: () => void): void; closeAllConnections?: () => void }) =>
  new Promise<void>((resolve) => {
    server.closeAllConnections?.();
    server.close(() => resolve());
  });

test("validator matches load.py semantics for partial, wrong and article pages", () => {
  const body = '<main data-token="trial"></main></html><!--complete-->';
  assert.equal(validateResponse(200, body, 0, "trial"), true);
  assert.equal(validateResponse(502, body, 0, "trial"), false);
  assert.equal(validateResponse(200, body.slice(0, -16), 0, "trial"), false);
  assert.equal(validateResponse(200, body.replace(/trial/, "other"), 0, "trial"), false);
  assert.equal(validateResponse(200, body, 1, "trial"), false);
  const one = page(1);
  assert.equal(validateResponse(200, Buffer.from(one), 1, "trial"), true);
  assert.equal(validateResponse(200, one.replace(">5<", ">999<"), 1, "trial"), false);
  assert.equal(validateResponse(200, one.replace('data-row="0"', 'data-row="1"'), 1, "trial"), false);
  assert.equal(validateResponse(200, one, 1, "trial", true), false);
  assert.equal(validateResponse(200, page(3), 2, "trial"), false, "extra rows are rejected");
});

test("strings variant: exact parsed field text, any valid encoding, raw markup and wrong characters rejected", () => {
  const escape = (text: string, style: "named" | "numeric" | "hex") =>
    text.replace(/[<>&"']|[^\x00-\x7f]/gu, (c) =>
      style === "named" && c in NAMED ? NAMED[c]! : c.charCodeAt(0) < 0x80 || style !== "named" ? (style === "hex" ? `&#x${c.codePointAt(0)!.toString(16)};` : `&#${c.codePointAt(0)};`) : c,
    );
  const NAMED: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" };
  const build = (encode: (text: string) => string) => {
    let html = '<html><main data-token="t">';
    for (let row = 0; row < 3; row++) {
      html += `<article data-row="${row}"><dl>`;
      for (let field = 0; field < 10; field++) html += `<dd><!--[-->${encode(fieldText(row, field, true))}<!--]--></dd>`;
      html += "</dl></article>";
    }
    return Buffer.from(html + "</main></html><!--complete-->", "utf8");
  };
  assert.equal(fieldText(1, 3, true), `<b>"103"</b> & 'é€漢字𝄞'`);
  assert.equal(fieldText(1, 4, true), "104");
  for (const style of ["named", "numeric", "hex"] as const) assert.equal(validateResponse(200, build((t) => escape(t, style)), 3, "t", false, true), true, style);
  assert.equal(validateResponse(200, build((t) => escape(t, "named")), 3, "t"), false, "integer expectations differ");
  assert.equal(validateResponse(200, build((t) => t), 3, "t", false, true), false, "unescaped <b> is markup, not text");
  assert.equal(validateResponse(200, build((t) => escape(t.replace("漢", "汉"), "named")), 3, "t", false, true), false, "wrong character");
  assert.equal(validateResponse(200, build((t) => escape(t, "named").replace("&amp;", "&amp;amp;")), 3, "t", false, true), false, "double escaping");
});

test("text grid variant (strings=2): 24-64 char ASCII fields, exact parsed text", () => {
  for (const row of [0, 1, 4999])
    for (let field = 0; field < 10; field++) {
      const text = fieldText(row, field, 2);
      assert.ok(text.length >= 24 && text.length <= 64 && /^[\x20-\x7e]+$/.test(text), `${row}/${field}: ${text}`);
    }
  assert.equal(fieldText(1, 3, 2), "Ada Lovelace & Co <ada.103@example.com>");
  assert.equal(fieldText(1, 5, 2), "Updated 2026-10-07 12:45:00 UTC by system");
  const escape = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  let html = '<html><main data-token="t">';
  for (let row = 0; row < 2; row++) {
    html += `<article data-row="${row}"><dl>`;
    for (let field = 0; field < 10; field++) html += `<dd>${escape(fieldText(row, field, 2))}</dd>`;
    html += "</dl></article>";
  }
  const body = Buffer.from(html + "</main></html><!--complete-->", "utf8");
  assert.equal(validateResponse(200, body, 2, "t", false, 2), true);
  assert.equal(validateResponse(200, body, 2, "t", false, 1), false, "escaping-variant expectations differ");
  assert.equal(validateResponse(200, body.toString().replace("&lt;ada", "<ada"), 2, "t", false, 2), false, "raw markup rejected");
});

test("closed loop parses Content-Length, split chunked and close-delimited bodies", async () => {
  const body = page(20);
  const length = createHttpServer((_, res) => {
    res.setHeader("Content-Length", Buffer.byteLength(body));
    res.end(body);
  });
  // Chunked with tiny writes so heads, chunk sizes and CRLFs straddle TCP reads.
  const chunked = createHttpServer(async (_, res) => {
    res.write(body.slice(0, 7));
    await new Promise((resolve) => setImmediate(resolve));
    for (let at = 7; at < body.length; at += 333) res.write(body.slice(at, at + 333));
    res.end();
  });
  const raw = createNetServer((socket) => {
    socket.once("data", () => socket.end(`HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n${body}`));
  });
  try {
    for (const server of [length, chunked, raw]) {
      const url = (await listen(server)) + "/page?rows=20";
      const { summary, generator } = await runLoad({ url, rows: 20, token: "trial", concurrency: 2, duration: 0.2, threads: 1 });
      assert.ok(summary.successful > 2, `successful=${summary.successful}`);
      assert.equal(summary.failed, 0, JSON.stringify(summary.errors));
      assert.equal(summary.mean_response_bytes, Buffer.byteLength(body));
      assert.ok(summary.validation.strict >= 2);
      assert.equal(summary.validation.strict + summary.validation.length_checked, summary.successful);
      assert.equal(generator.threads, 1);
      if (server === raw) assert.ok(generator.reconnects > 0);
    }
  } finally {
    await Promise.all([close(length), close(chunked), close(raw)]);
  }
});

test("chunked parser survives byte-at-a-time delivery, extensions and trailers", async () => {
  const body = page(3);
  const pieces = [body.slice(0, 100), body.slice(100, 101), body.slice(101)];
  const wire =
    "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n" +
    pieces.map((piece, i) => piece.length.toString(16) + (i === 1 ? ";ext=1" : "") + "\r\n" + piece + "\r\n").join("") +
    "0\r\nX-Trailer: yes\r\n\r\n";
  const server = createNetServer((socket) => {
    socket.on("data", async () => {
      for (let at = 0; at < wire.length; at += 7) {
        socket.write(wire.slice(at, at + 7));
        await new Promise((resolve) => setImmediate(resolve));
      }
    });
  });
  try {
    const url = (await listen(server)) + "/page";
    const { summary, generator } = await runLoad({ url, rows: 3, token: "trial", concurrency: 1, duration: 0.15, threads: 1, sample_every: 1 });
    assert.ok(summary.successful > 1);
    assert.equal(summary.failed, 0, JSON.stringify(summary.errors));
    assert.equal(summary.mean_response_bytes, Buffer.byteLength(body));
    assert.equal(summary.validation.strict, summary.successful);
    assert.equal(generator.reconnects, 0, "keep-alive connection stays in sync");
  } finally {
    await close(server);
  }
});

test("errors, wrong status and corrupted pages are failures even when unsampled", async () => {
  let count = 0;
  const server = createHttpServer((req, res) => {
    count++;
    if (req.url!.startsWith("/bad")) {
      res.writeHead(502);
      res.end("bad gateway");
      return;
    }
    // Every 3rd page is corrupted with a length change; sampling alone (1 in 1000) would miss it.
    res.end(count % 3 === 0 ? page(5, "trial", (html) => html.replace(">205<", ">99999<")) : page(5));
  });
  try {
    const base = await listen(server);
    const bad = await runLoad({ url: base + "/bad", rows: 5, token: "trial", concurrency: 1, duration: 0.1, threads: 1 });
    assert.equal(bad.summary.successful, 0);
    assert.ok(bad.summary.errors.HTTP502! > 0);
    const mixed = await runLoad({ url: base + "/page", rows: 5, token: "trial", concurrency: 1, duration: 0.2, threads: 1, sample_every: 1000 });
    assert.ok(mixed.summary.errors.InvalidPage! > 0);
    const columns = mixed.request_columns;
    for (let i = 0; i < columns.flags.length; i++)
      if (columns.bytes[i] !== Buffer.byteLength(page(5)) && columns.status[i] === 200) assert.equal(columns.flags[i]! & 1, 0);
    const refused = await runLoad({ url: "http://127.0.0.1:1/page", rows: 0, token: "trial", concurrency: 1, duration: 0.05, threads: 1 });
    assert.equal(refused.summary.successful, 0);
    assert.ok(refused.summary.failed > 0);
  } finally {
    await close(server);
  }
});

test("open loop counts queueing behind a slow server (no coordinated omission)", async () => {
  const body = page(1);
  const server = createHttpServer((_, res) => setTimeout(() => res.end(body), 40));
  try {
    const url = (await listen(server)) + "/page";
    const closed = await runLoad({ url, rows: 1, token: "trial", concurrency: 1, duration: 0.4, threads: 1 });
    // 100/s offered against ~25/s capacity: arrivals queue, latency counts from the schedule.
    const open = await runLoad({ url, rows: 1, token: "trial", concurrency: 1, duration: 0.4, rate: 100, threads: 1 });
    assert.equal(open.summary.mode, "open-loop");
    assert.equal(open.summary.attempts, 40);
    assert.equal(open.summary.failed, 0);
    assert.ok(closed.summary.p99_ms! < 120, `closed p99 ${closed.summary.p99_ms}`);
    assert.ok(open.summary.p99_ms! > 3 * closed.summary.p99_ms!, `open p99 ${open.summary.p99_ms} vs closed ${closed.summary.p99_ms}`);
    assert.ok(open.summary.max_admission_delay_ms > 500);
  } finally {
    await close(server);
  }
});

test("open loop splits the arrival schedule across worker threads and caps drain", async () => {
  const body = page(2);
  const server = createHttpServer((req, res) => {
    if (req.url!.startsWith("/hang")) return;
    res.end(body);
  });
  try {
    const base = await listen(server);
    const { summary, generator } = await runLoad({ url: base + "/page", rows: 2, token: "trial", concurrency: 4, duration: 0.3, rate: 200, threads: 2 });
    assert.equal(generator.threads, 2);
    assert.equal(generator.worker_elu.length, 2);
    assert.equal(summary.attempts, 60);
    assert.equal(summary.failed, 0);
    assert.ok(Math.abs(summary.rps - 200) < 60, `rps ${summary.rps}`);
    const hung = await runLoad({ url: base + "/hang", rows: 2, token: "trial", concurrency: 1, duration: 0.1, rate: 50, threads: 1, drain_seconds: 0.2 });
    assert.equal(hung.summary.attempts, 5);
    assert.equal(hung.summary.successful, 0);
    assert.equal(hung.summary.unsent + (hung.summary.errors.DrainTimeout ?? 0), 5);
  } finally {
    await close(server);
  }
});
