import { signal } from "@rivetjs/reactivity";
import { guard, load, type PageProps } from "@rivetjs/router";
import { privateToken } from "../private.server";
import { PUBLIC_STEP } from "./api/info";
export const access = guard(() => {
  const secret = "INLINE_GUARD_CANARY_82ab20d4";
  void secret;
});
export const loader = load(({ url }) => {
  const unused = "INLINE_LOADER_CANARY_4e9b1e89";
  if (!privateToken || !unused) throw new Error("bad fixture");
  return { publicValue: "PUBLIC_LOADER_CONTROL", payload: url.searchParams.get("q") ?? "safe" };
});
export default function Home({ data }: PageProps<typeof loader>) {
  const n = signal(0);
  return (
    <main>
      <h1 id="public">{data.publicValue}</h1>
      <p id="text">{data.payload}</p>
      <div id="attribute" title={data.payload}>
        attribute
      </div>
      <a id="url" href={data.payload}>
        link
      </a>
      <svg>
        <a id="svg-url" href={data.payload}>
          <text>SVG link</text>
        </a>
      </svg>
      <button id="count" onClick={() => n.update((v) => v + PUBLIC_STEP)}>
        {n()}
      </button>
    </main>
  );
}
