import { signal } from "@rivetjs/reactivity";
import { GridList, GridListItem, type Selection } from "@rivetjs/cdk/grid-list";
import { GridLayout, CollectionVirtualizer, type Size } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: GridList" };

interface Card {
  id: number;
  name: string;
}

const cards: Card[] = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, name: `Card ${i + 1}` }));

// #region demo
export default function Cards() {
  const selected = signal<Selection>(new Set());
  const text = () => {
    const keys = selected();
    return keys === "all" ? "all" : [...keys].join(", ") || "none";
  };
  return (
    <section class="stack">
      {/* 88 x 64 cards, 8px apart: three columns in the 298px wide scroller. */}
      <CollectionVirtualizer
        layout={GridLayout}
        // JSON options: plain { width, height } objects (the layout reads them as sizes).
        layoutOptions={{
          minItemSize: { width: 88, height: 64 } as Size,
          maxItemSize: { width: 88, height: 64 } as Size,
          minSpace: { width: 8, height: 8 } as Size,
          preserveAspectRatio: true,
        }}
        initialSize={{ width: 298, height: 298 }}
      >
        <GridList
          id="cards"
          aria-label="Cards"
          layout="grid"
          items={cards}
          selectionMode="multiple"
          selectedKeys={selected}
          onSelectionChange={(keys) => selected.set(keys)}
        >
          {(card: Card) => (
            <GridListItem id={card.id} textValue={card.name}>
              {card.name}
            </GridListItem>
          )}
        </GridList>
      </CollectionVirtualizer>
      <output id="cards-value">Selected: {text()}</output>
    </section>
  );
}
// #endregion
