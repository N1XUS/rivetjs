/** "<count> <label>"; `data-empty` only when the count is 0. Props are read where they are shown (live props). */
export function Badge(props: { count: number; label: string }) {
  return (
    <span class="badge" data-empty={props.count === 0 ? "" : undefined}>
      {props.count} {props.label}
    </span>
  );
}
