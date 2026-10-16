import { defineRoute, createRouter, Router } from "../server-router.js";
import { compileRoutes, type RouteMatch } from "../router.js";
import type { ServerValue } from "../server.js";
const loaded = defineRoute("/users/:id", {
  load: async (work, match) => {
    const signal: AbortSignal = work.signal;
    const id: string = match.params.id;
    return { name: id, count: 1 };
  },
  render: (data, match) => {
    const name: string = data.name;
    const count: number = data.count;
    // @ts-expect-error loaded object has no missing property
    data.missing;
    // @ts-expect-error loaded count is a number
    const wrong: string = data.count;
    // @ts-expect-error params are immutable
    match.params.id = "other";
    return (
      <p>
        {name}
        {count}
      </p>
    );
  },
});
const number = defineRoute("/count", { load: () => 42, render: (data) => data.toFixed() });
const sync = defineRoute("/", {
  render: (data, match) => {
    const empty: undefined = data;
    return match.url.pathname;
  },
});
const explicit = defineRoute<string>("/explicit", { load: () => "text", render: (text) => text.toUpperCase() });
// @ts-expect-error render is required
const missing = defineRoute("/missing", { load: () => 1 });
// @ts-expect-error loader and render data must agree
const incorrect = defineRoute<number>("/bad", { load: () => "text", render: (data) => data });
// @ts-expect-error route rendering cannot return unsupported objects
const invalid = defineRoute("/invalid", { load: () => 1, render: () => ({ bad: true }) });
const router = createRouter("https://routes.test");
const node = (
  <Router router={router} routes={[loaded, number, sync, explicit]} notFound={(url) => <p>{url.pathname}</p>} />
);
// @ts-expect-error router is required
const noRouter = <Router routes={[loaded]} />;
// @ts-expect-error definitions need render
const badRoutes = <Router router={router} routes={[{ path: "/a" }]} />;
const match: RouteMatch<{ name: string; count: number }, ServerValue> | null = compileRoutes([loaded])(
  router.location(),
);
