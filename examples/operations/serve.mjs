// Production server: serves dist/client files and renders pages with the server build.
import { start } from "@rivetjs/router/node";
import WebSocket from "ws";
import { backend } from "./src/server/backend.server.ts";
import { sessionUser, eventsFor } from "./src/server/service.server.ts";

// Production builds of the libraries the server build loads (React, …): set before `start()` imports it.
process.env.NODE_ENV ??= "production";
const serving = await start({ dist: "dist", port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? "127.0.0.1" });
const sockets = new WebSocket.Server({ noServer: true });
const privateSockets = new WebSocket.Server({ noServer: true });
serving.server.on("upgrade", (request, socket, head) => {
  if (request.url === "/case-socket") {
    if (request.headers.origin !== `http://${request.headers.host}`) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
      return;
    }
    const token = request.headers.cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("case-session="))
      ?.slice("case-session=".length);
    const user = sessionUser(token);
    if (!user) {
      socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
      return;
    }
    privateSockets.handleUpgrade(request, socket, head, (ws) => {
      ws.send(JSON.stringify({ type: "ready", tenant: user.tenant }));
      let cursor = 0;
      const timer = setInterval(() => {
        const current = sessionUser(token);
        if (!current) {
          ws.close(4001, "Session ended");
          return;
        }
        for (const event of eventsFor(current, cursor)) {
          cursor = event.id;
          if (ws.readyState === 1) ws.send(JSON.stringify({ type: "message", ...event }));
        }
      }, 40);
      ws.on("close", () => clearInterval(timer));
    });
    return;
  }
  if (request.url !== "/socket") return socket.destroy();
  sockets.handleUpgrade(request, socket, head, (ws) => sockets.emit("connection", ws, request));
});
sockets.on("connection", (socket) => {
  backend.stats.wsActive++;
  backend.stats.wsStarted++;
  let id = 0;
  const timer = setInterval(() => {
    if (socket.readyState === 1) socket.send(JSON.stringify({ id: ++id }));
  }, 25);
  socket.on("close", () => {
    clearInterval(timer);
    backend.stats.wsActive--;
  });
});
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  for (const socket of [...sockets.clients, ...privateSockets.clients]) socket.terminate();
  sockets.close();
  privateSockets.close();
  await serving.close();
  process.exit(0);
}
process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
console.log(`Listening on ${serving.url}`);

process.send?.({ url: serving.url });
