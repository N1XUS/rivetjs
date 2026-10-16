// Big number that counts up as it scrolls into view. CSS only (home.css "Count-up"): the real value is text in the
// DOM (`<data value>`, read by assistive technology, reserves the width); where scroll-driven animations exist the
// text turns transparent and a `::after` counter (alt text "", so not announced) runs 0 → value on a view timeline.
// Elsewhere (no scroll timelines, reduced motion, print) the real text simply shows, and a number not yet scrolled to
// shows its final value (the animation fills forwards only): complete at rest.

export interface CountUpProps {
  /** The number as shown, e.g. "3.6×", "17×", "41.8 ms": a number with 0 or 1 decimals, then a suffix. */
  text: string;
  class?: string;
}

/** `"3.6×"` → { tenths: 36, digits: 1, suffix: "×" }. */
export function parseCount(text: string): { value: number; tenths: number; digits: 0 | 1; suffix: string } {
  const match = /^(\d+)(?:\.(\d))?(.*)$/.exec(text);
  if (!match) throw new Error(`CountUp: "${text}" is not a number with at most one decimal`);
  const digits = match[2] === undefined ? 0 : 1;
  const tenths = Number(match[1]) * 10 + Number(match[2] ?? 0);
  return { value: tenths / 10, tenths, digits, suffix: match[3]! };
}

export function CountUp(props: CountUpProps) {
  const count = parseCount(props.text);
  return (
    <data
      class={"cu" + (props.class ? " " + props.class : "")}
      value={String(count.value)}
      data-digits={String(count.digits)}
      data-suffix={count.suffix}
      style={{ "--cu-to": String(count.tenths) }}
    >
      {props.text}
    </data>
  );
}
