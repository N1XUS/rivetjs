// TERNARY-MEMO: conditional children whose test reads a signal that changes without switching the branch
// (`n() > 0`, `n() && …`, nested, lazy / fragment children). `#inc` steps `n` 1 → 2 → 3 …; every JSX branch node
// carries a class so the test can mark it and check it is kept.
import { signal } from "@rivetjs/reactivity";

const Box = (props: { children?: unknown }) => <section class="box">{props.children as never}</section>;

export function Page() {
  const n = signal(1);
  return (
    <main>
      <button type="button" id="inc" onClick={() => n.set(n() + 1)}>
        +
      </button>
      <p id="tern">{n() > 0 ? <b class="pos">pos {n()}</b> : <i>neg</i>}</p>
      <p id="and">x{n() && <b class="and">and</b>}y</p>
      <p id="nest">{n() > 0 ? n() > 2 ? <b class="big">big</b> : <b class="small">small</b> : null}</p>
      <p id="value">{n() > 100 ? <b>huge</b> : n()}</p>
      <div id="frag">{<>f{n() > 0 ? <b class="frag">frag</b> : null}</>}</div>
      <Box>{n() > 0 && <b class="lazy">lazy</b>}</Box>
    </main>
  );
}
