import { signal } from "@rivetjs/reactivity";
import { Breadcrumb, Breadcrumbs } from "@rivetjs/cdk/breadcrumbs";
import { Link } from "@rivetjs/cdk/link";

export const head = { title: "Breadcrumbs DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid gap-3 text-sm">
      <Breadcrumbs id="dom-trail" lang="ko" onPointerDown={() => add("list:pointerdown")} onWheel={() => add("list:wheel")}>
        <Breadcrumb lang="en">
          <Link href="#home">Home</Link>
        </Breadcrumb>
        <Breadcrumb onPointerEnter={() => add("here:pointerenter")}>
          <Link>여기</Link>
        </Breadcrumb>
      </Breadcrumbs>
      <output id="dom-bc-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
