import type { PageProps } from "@rivetjs/router";

export const serverLoad = ({ url }: { url: URL }) => ({ path: url.pathname });

export default function About({ data }: PageProps<{ path: string }, {}>) {
  return (
    <section>
      <h1>About</h1>
      <p id="path">{data.path}</p>
    </section>
  );
}
