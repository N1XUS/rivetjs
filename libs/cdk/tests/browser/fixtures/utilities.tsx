// Client-rendered fixtures for utilities.test.ts.
import type { Signal } from "@rivetjs/reactivity";
import { Dir } from "../../../bidi/bidi-dir.tsx";
import { injectDirectionality, type Directionality } from "../../../bidi/index.ts";
import { RouterProvider, useRouter, type Router } from "../../../utils/links.tsx";

function DirProbe(props: { out: { dir?: Directionality } }) {
  props.out.dir = injectDirectionality();
  return <span class="probe">{props.out.dir.valueSignal()}</span>;
}

export function DirFixture(props: { direction: Signal<string>; changes: string[]; out: { dir?: Directionality } }) {
  return (
    <Dir dir={() => props.direction()} onDirChange={(d) => props.changes.push(d)}>
      {() => <DirProbe out={props.out} />}
    </Dir>
  );
}

function RouterProbe(props: { out: { router?: Router } }) {
  props.out.router = useRouter();
  return <span />;
}

export function RouterFixture(props: { navigations: string[]; out: { router?: Router } }) {
  return (
    <RouterProvider navigate={(path) => props.navigations.push(path)} useHref={(h) => "/base" + h}>
      {() => <RouterProbe out={props.out} />}
    </RouterProvider>
  );
}
