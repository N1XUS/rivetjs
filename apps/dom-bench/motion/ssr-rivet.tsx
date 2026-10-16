// Motion suite, SSR lane rivet: 1000 Motion elements rendered to a string (server compile). `entrance` renders
// inside a router head sink (what a `@rivetjs/router` page has: one `@keyframes` rule in the head, `data-mve` per
// element); `entrance-vars` without one (custom-property form).
import { Provider, renderToString } from "@rivetjs/runtime/server";
import { ServerData } from "@rivetjs/router/route-context";
import type { HeadSink } from "@rivetjs/router";
import { Motion } from "@rivetjs/motion";

const rows = Array.from({ length: 1000 }, (_, i) => i);
const list = () => (
  <ul>
    {rows.map((i) => (
      <Motion.li initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {"row " + i}
      </Motion.li>
    ))}
  </ul>
);
const page = () => {
  let head = "";
  const headSink: HeadSink = {
    nonce: "n",
    push(_level, entry) {
      head += JSON.stringify(entry);
      return undefined;
    },
  };
  const value = { url: new URL("http://bench.test/"), data: undefined, headSink } as never;
  return head + String(renderToString(() => Provider({ token: ServerData, value, children: list as never })));
};
export const ssr = {
  // Floor: the same list without Motion (plain `<li style>`).
  plain: () =>
    String(
      renderToString(() => (
        <ul>
          {rows.map((i) => (
            <li style={{ opacity: 1 }}>{"row " + i}</li>
          ))}
        </ul>
      )),
    ),
  static: () =>
    String(
      renderToString(() => (
        <ul>
          {rows.map((i) => (
            <Motion.li animate={{ opacity: 1 }}>{"row " + i}</Motion.li>
          ))}
        </ul>
      )),
    ),
  entrance: page,
  "entrance-vars": () => String(renderToString(list)),
};
