// Renders on the server; throws when the browser renders it (client navigation, no ErrorBoundary).
export default function ClientBoom() {
  if (typeof document !== "undefined") throw new Error("client render exploded");
  return <h1 id="client-boom">Client boom</h1>;
}
