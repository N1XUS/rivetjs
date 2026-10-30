import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
export function Transports() {
  const sse = signal(0),
    ws = signal(0),
    status = signal("connecting");
  clientEffect(() => {
    const source = new EventSource("/api/events?limit=10000&ms=25");
    source.onmessage = (e) => {
      sse.set(JSON.parse(e.data).id);
    };
    const socket = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/socket`);
    socket.onopen = () => {
      status.set("connected");
      socket.send("hello");
    };
    socket.onmessage = (e) => {
      ws.set(JSON.parse(e.data).id);
    };
    return () => {
      source.close();
      socket.close();
    };
  });
  return (
    <div>
      <p id="transport-status">{status()}</p>
      <p>
        SSE messages: <output id="sse-count">{sse()}</output>
      </p>
      <p>
        WebSocket messages: <output id="ws-count">{ws()}</output>
      </p>
    </div>
  );
}
