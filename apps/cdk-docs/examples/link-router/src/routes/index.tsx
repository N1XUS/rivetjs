import { signal } from "@rivetjs/reactivity";
import { Link, RouterProvider } from "@rivetjs/cdk/link";

export const head = { title: "Links with RouterProvider" };

// #region demo
export default function Routed() {
  const last = signal("none");
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <RouterProvider
        // Your router's navigate; plain Rivet apps need no provider (@rivetjs/router intercepts anchors).
        navigate={(href, options) => last.set(`navigate ${href} ${JSON.stringify(options)}`)}
        useHref={(href) => "/app" + href}
      >
        {() => (
          <p class="flex gap-4">
            <Link id="rl-guide" href="/guide" routerOptions={{ scroll: false }}>
              Guide
            </Link>
            {/* Not a same-tab navigation: the browser handles it. */}
            <Link id="rl-blank" href="/api" target="_blank">
              API (new tab)
            </Link>
          </p>
        )}
      </RouterProvider>
      <output id="rl-log" class="font-mono text-xs text-slate-600">
        {last()}
      </output>
    </section>
  );
}
// #endregion
