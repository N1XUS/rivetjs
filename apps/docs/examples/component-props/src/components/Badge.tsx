// #region demo
/** A label and a live number. Props are live: `props.count` follows the signal the parent passes. */
export function Badge(props: { label: string; count: number }) {
  return (
    <span class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
      {props.label}
      <b class="font-mono" id={"badge-" + props.label.toLowerCase()}>
        {props.count}
      </b>
    </span>
  );
}
// #endregion
