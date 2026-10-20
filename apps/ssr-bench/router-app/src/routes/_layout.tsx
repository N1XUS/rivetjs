import type { LayoutProps } from "@rivetjs/router";
import { load } from "@rivetjs/router";

// Root layout with its own loader: the router merges it with the page's and renders the page inside.
export const loader = load(() => {
  return { lane: "rivet-router" };
});

export default function Layout({ data, children }: LayoutProps<typeof loader>) {
  return <div data-lane={data().lane}>{children}</div>;
}
