import { load, type PageProps } from "@rivetjs/router";
import { Async } from "@rivetjs/runtime/dom";
import { HeadLink, Script, Title } from "@rivetjs/kit";

// Shell cache (route rule `shell` in `../../vite.config.ts`, PPR-T57): head components inside a hole render after the
// shell, so only body-valid entries apply, in place (`<HeadLink>`, `<Script>`: the live nonce), and `<Title>` is ignored
// with a warning — on an H-holes hit as on a fresh render (the hole pushes into the hit's head sink, not the fill's).
export const loader = load(
  async () => {
    await new Promise((done) => setTimeout(done, 5));
    return { label: "late" };
  },
  { defer: true },
);

function Late(props: { label: string }) {
  return (
    <p id="late">
      <Title>Ignored</Title>
      <HeadLink rel="prefetch" href="/next.json" />
      <Script src="/late-hole.js" />
      {props.label}
    </p>
  );
}

export default function Shell({ data }: PageProps<typeof loader>) {
  return (
    <section>
      <Title>Shell</Title>
      <h1 id="shell">Shell</h1>
      <Async load={() => data} fallback={() => <p id="wait">…</p>}>
        {(value) => <Late label={value.label} />}
      </Async>
    </section>
  );
}
