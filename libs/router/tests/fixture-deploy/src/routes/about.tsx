import type { PageProps } from "@rivetjs/router";
import { load } from "@rivetjs/router";

// Prerendered at build time by the platform targets (a static file; no function call).
export const prerender = true;
export const loader = load(() => ({ built: "at build time" }));

export const head = { title: "About" };
export default function About({ data }: PageProps<typeof loader>) {
  return <h1 id="about">About {data.built}</h1>;
}
