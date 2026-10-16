import { signal } from "@rivetjs/reactivity";
import { Virtualizer, WaterfallLayout, type Size } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: waterfall" };

const cards = Array.from({ length: 500 }, (_, i) => ({ id: i, height: 60 + ((i * 53) % 5) * 24, hue: (i * 47) % 360 }));

// #region demo
export default function Cards() {
  const top = signal(0);
  return (
    <section class="stack">
      <button
        id="cards-bottom"
        type="button"
        onClick={() => {
          const scroller = document.getElementById("cards")!;
          scroller.scrollTop = scroller.scrollHeight;
        }}
      >
        Bottom
      </button>
      <Virtualizer
        id="cards"
        role="list"
        label="Cards"
        tabIndex={0}
        items={cards}
        layout={() => new WaterfallLayout()}
        layoutOptions={{ minItemSize: { width: 90, height: 60 } as Size, minSpace: { width: 8, height: 8 } as Size, maxColumns: 3 }}
        initialSize={{ width: 320, height: 240 }}
        style={{ width: "320px", height: "240px" }}
        onScroll={(event) => top.set((event.currentTarget as HTMLElement).scrollTop)}
      >
        {(card) => (
          <div role="listitem" class="tile" style={{ height: `${card().height}px`, background: `hsl(${card().hue} 70% 88%)` }}>
            {card().id}
          </div>
        )}
      </Virtualizer>
      <output id="cards-top">scrollTop: {top()}</output>
    </section>
  );
}
// #endregion
