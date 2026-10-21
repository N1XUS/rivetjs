import { load, type PageProps } from "@rivetjs/router";
import { Async } from "@rivetjs/runtime/dom";

// Forbidden: deferred data rendered in order (an `Async` without a fallback waits in the shell).
export const loader = load(async () => ({ stock: 3 }), { defer: true });

export default function InOrder({ data }: PageProps<typeof loader>) {
  return <Async load={() => data}>{(value) => <p id="stock">{value.stock}</p>}</Async>;
}
