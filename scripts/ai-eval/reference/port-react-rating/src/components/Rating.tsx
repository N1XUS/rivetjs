import { signal } from "@rivetjs/reactivity";

/** Star rating. The parent owns the value (`value` + `onChange`); hover previews a rating. */
export function Rating(props: { value: number; onChange: (value: number) => void; max?: number }) {
  const hover = signal(0);
  const stars = Array.from({ length: props.max ?? 5 }, (_, i) => i + 1);
  return (
    <div role="radiogroup" aria-label="Rating" onMouseLeave={() => hover.set(0)}>
      {stars.map((n) => (
        <button
          type="button"
          role="radio"
          aria-checked={n === props.value ? "true" : "false"}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          class={n <= (hover() || props.value) ? "star on" : "star"}
          onMouseEnter={() => hover.set(n)}
          onClick={() => props.onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
