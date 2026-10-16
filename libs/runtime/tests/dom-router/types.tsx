import { createRouter, Router, defineRoute } from "../../dom-router.js";
import { mount } from "@rivetjs/runtime/dom";
const route = defineRoute("/users/:id", {
  load: async (work, match) => {
    work.signal.throwIfAborted();
    return { count: match.params.id.length };
  },
  render: (data, match) => {
    const render: (value: { count: number }, snapshot: typeof match) => unknown = match.route.render;
    const same: typeof data = data;
    return <b>{same.count.toFixed() + match.url.search}</b>;
  },
});
const sync = defineRoute("/", {
  render: (data) => {
    const unused: undefined = data;
    return "home";
  },
});
mount(() => {
  const router = createRouter();
  router.navigate("/", { replace: true });
  return <Router router={router} routes={[route, sync]} />;
}, document.body);
// @ts-expect-error loader data remains numeric
const wrong = defineRoute("/", { load: () => 1, render: (data) => data.missing });
// @ts-expect-error route render is required
defineRoute("/", { load: () => 1 });
// @ts-expect-error navigate options are boolean
createRouter().navigate("/", { replace: "yes" });

// @ts-expect-error a render annotation cannot broaden loader data
defineRoute("/", { load: () => 1, render: (data: string) => data });
