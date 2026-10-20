// Renders on the server, throws when the browser renders it (client navigation): the router loads the document.
export default function Broken() {
  if (typeof document !== "undefined") throw new Error("broken in the browser");
  return <h1>Broken (server)</h1>;
}
