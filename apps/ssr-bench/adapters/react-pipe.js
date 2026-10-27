import { Writable } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { NodeStreamWriter } from "../../../libs/runtime/node.ts";

/** Streams a React element through React 19's Node API (`renderToPipeableStream`, piped once the shell is ready)
 * into the caller-owned response. React ends the stream it pipes into, so it pipes into a wrapper over the shared
 * `NodeStreamWriter` (as the Solid lanes wrap theirs): the HTTP server keeps the response open for its shared
 * completion marker. */
export function pipeReact(element, { signal, ...options }, sink) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    let failure;
    const writer = new NodeStreamWriter(sink, { signal, threshold: 1 });
    const destination = new Writable({
      write(chunk, _encoding, done) {
        let waiting;
        try {
          waiting = writer.writeBytes(chunk);
        } catch (error) {
          return done(error);
        }
        if (waiting) waiting.then(() => done(), done);
        else done();
      },
      final(done) {
        let waiting;
        try {
          waiting = writer.finish();
        } catch (error) {
          return done(error);
        }
        if (waiting) waiting.then(() => done(), done);
        else done();
      },
    });
    const abort = () => stream.abort(signal.reason);
    const settle = (error) => {
      signal?.removeEventListener("abort", abort);
      error ? reject(error) : resolve();
    };
    destination.once("finish", () => settle(failure));
    destination.once("error", settle);
    const stream = renderToPipeableStream(element, {
      ...options,
      onShellReady() {
        stream.pipe(destination);
      },
      onShellError: settle,
      onError(error) {
        failure ??= error;
      },
    });
    signal?.addEventListener("abort", abort, { once: true });
  });
}
