import { Virtualizer, ListLayout } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: plain CSS" };

const cards = Array.from({ length: 1000 }, (_, i) => `Card ${i}`);

// #region demo
export default function Cards() {
  return (
    <Virtualizer
      id="cards-list"
      role="list"
      label="Cards"
      tabIndex={0}
      items={cards}
      layout={() => new ListLayout()}
      layoutOptions={{ rowSize: 32, gap: 4, padding: 8 }}
      initialSize={{ width: 320, height: 240 }}
    >
      {(card) => (
        <div role="listitem" class="card">
          {card()}
        </div>
      )}
    </Virtualizer>
  );
}
// #endregion
