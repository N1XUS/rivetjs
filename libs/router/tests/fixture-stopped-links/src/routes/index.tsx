// Links whose own handler stops propagation (a cdk Link's press does): on a resumed page the handler runs from the
// resume loader's document capture listener, before the router's bubbling click listener.
export default function Home() {
  return (
    <main>
      <h1>Home</h1>
      <a id="to-target" href="#target" onClick={(event: MouseEvent) => event.stopPropagation()}>
        to target
      </a>{" "}
      <a id="to-other" href="/other" onClick={(event: MouseEvent) => event.stopPropagation()}>
        other
      </a>
      <div style={{ height: "2000px" }} />
      <h2 id="target">Target</h2>
    </main>
  );
}
