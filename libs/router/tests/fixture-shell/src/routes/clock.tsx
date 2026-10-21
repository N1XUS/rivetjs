import { load, type PageProps } from "@rivetjs/router";

// A nondeterministic shell (module state in render): a hit's replay differs from the stored shell → mismatch fallback.
export const loader = load(() => ({ label: "clock" }));
const tick = { n: 0 };

export default function Clock({ data }: PageProps<typeof loader>) {
  tick.n += 1;
  return (
    <p id="clock">
      {data.label} {String(tick.n)}
    </p>
  );
}
