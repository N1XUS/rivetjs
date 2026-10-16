import { signal } from "@rivetjs/reactivity";
import { viewportRuler } from "@rivetjs/cdk/scrolling";

export const head = { title: "ViewportRuler" };

// #region demo
export default function Ruler() {
  const size = signal("not measured");
  const scroll = signal("not measured");
  const rect = signal("not measured");
  const resizes = signal(-1);
  const read = () => {
    const ruler = viewportRuler();
    const { width, height } = ruler.getViewportSize();
    const position = ruler.getViewportScrollPosition();
    const r = ruler.getViewportRect();
    size.set(`${width} × ${height}`);
    scroll.set(`top ${position.top}, left ${position.left}`);
    rect.set(`top ${r.top}, bottom ${r.bottom}, left ${r.left}, right ${r.right}`);
  };
  const measure = () => {
    read();
    if (resizes() < 0) {
      resizes.set(0);
      // Window resize / orientationchange, throttled (default 20 ms); the listeners exist while subscribed.
      viewportRuler()
        .change()
        .subscribe(() => {
          resizes.set(resizes() + 1);
          read();
        });
    }
  };
  return (
    <section class="stack">
      <p>
        <button id="ruler-measure" type="button" onClick={measure}>
          Measure
        </button>{" "}
        <button
          id="ruler-scroll-page"
          type="button"
          onClick={() => {
            window.scrollTo(0, 120);
            measure();
          }}
        >
          Scroll the page by 120px and measure
        </button>
      </p>
      <output id="ruler-size">Viewport size: {size()}</output>
      <output id="ruler-scroll">Scroll position: {scroll()}</output>
      <output id="ruler-rect">Viewport rect: {rect()}</output>
      <output id="ruler-listening">{resizes() < 0 ? "not listening" : `listening to change(): ${resizes()} resize events`}</output>
      <div class="tall"></div>
    </section>
  );
}
// #endregion
