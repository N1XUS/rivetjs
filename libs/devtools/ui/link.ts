// Panel side of the protocol: docked (a MessagePort handed over by the page agent) or popped out
// (`#<session>`: a BroadcastChannel). Requests resolve with the agent's response of the same `r`, reject
// on its `error.request` response, and reject after `REQUEST_TIMEOUT` without one.
import { REQUEST_TIMEOUT, SOURCE, VERSION, channelName, type Envelope, type Events, type Requests } from "../protocol.ts";

export interface Link {
  request<K extends keyof Requests>(type: K, data: Requests[K][0]): Promise<Requests[K][1]>;
  readonly docked: boolean;
}
type Listener = <K extends keyof Events>(type: K, data: Events[K]) => void;

/** `onConnect` gets the agent's `welcome` (its protocol `v` may differ from the panel's `VERSION`). */
export function connect(onEvent: Listener, onConnect: (welcome: Events["welcome"]) => void): Link {
  const session = location.hash.slice(1);
  const docked = !session;
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  let seq = 0,
    port: MessagePort | null = null;
  const channel = docked ? null : new BroadcastChannel(channelName(session));
  const post = (message: Envelope) => (port ? port.postMessage([message]) : channel?.postMessage([message]));
  const receive = (data: unknown) => {
    if (!Array.isArray(data)) {
      // A reloaded page announces itself: shake hands again.
      if (data && (data as { ready?: true }).ready) hello();
      return;
    }
    for (const message of data as Envelope[]) {
      if (message.r !== undefined) {
        // A response: settle its request (unknown ids are late responses to timed-out requests).
        const waiting = pending.get(message.r);
        if (!waiting) continue;
        pending.delete(message.r);
        if (message.t === "error.request") waiting.reject(new Error((message.d as Events["error.request"]).message));
        else waiting.resolve(message.d);
      } else onEvent(message.t as keyof Events, message.d as never);
    }
  };
  const request = <K extends keyof Requests>(t: K, d: Requests[K][0]): Promise<Requests[K][1]> =>
    new Promise((resolve, reject) => {
      const r = ++seq;
      const timer = setTimeout(() => {
        if (pending.delete(r)) reject(new Error(t + ": no response in " + REQUEST_TIMEOUT / 1000 + " s"));
      }, REQUEST_TIMEOUT);
      pending.set(r, {
        resolve: (value) => (clearTimeout(timer), resolve(value as Requests[K][1])),
        reject: (error) => (clearTimeout(timer), reject(new Error(t + ": " + error.message))),
      });
      post({ v: VERSION, s: r, t, ts: performance.now(), d, r });
    });
  // An unanswered hello (no page yet) is retried when the page announces itself.
  const hello = () => void request("hello", { v: VERSION }).then(onConnect, () => {});
  if (channel) {
    channel.onmessage = (event) => receive(event.data);
    addEventListener("pagehide", () => channel.postMessage({ bye: true }));
    hello();
  } else
    addEventListener("message", (event) => {
      if (event.source !== parent || (event.data as { source?: string })?.source !== SOURCE || !event.ports[0]) return;
      port = event.ports[0];
      port.onmessage = (message) => receive(message.data);
      hello();
    });
  return { request, docked };
}
