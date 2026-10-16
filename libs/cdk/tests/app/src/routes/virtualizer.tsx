import { Virtualizer, ListLayout } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer" };

const rows = Array.from({ length: 10000 }, (_, i) => i);
const cols = Array.from({ length: 1000 }, (_, i) => i);

export default function VirtualizerStory() {
  return (
    <section>
      <h1>Virtualizer</h1>
      <Virtualizer
        id="list"
        role="list"
        label="Rows"
        items={rows}
        getKey={(n) => n}
        layout={() => new ListLayout()}
        layoutOptions={{ estimatedRowSize: 32 }}
        initialSize={{ width: 300, height: 300 }}
        style={{ width: "300px", height: "300px", border: "0" }}
      >
        {(n) => (
          <div role="listitem" class="vrow" style={{ height: n() % 7 === 0 ? "64px" : "32px", "box-sizing": "border-box" }}>
            Row {n()}
          </div>
        )}
      </Virtualizer>
      <Virtualizer
        id="rtl"
        dir="rtl"
        scrollDirection="horizontal"
        items={cols}
        getKey={(n) => n}
        layout={() => new ListLayout()}
        layoutOptions={{ orientation: "horizontal", rowSize: 50 }}
        initialSize={{ width: 200, height: 60 }}
        style={{ width: "200px", height: "60px" }}
      >
        {(n) => <div class="vcol">{n()}</div>}
      </Virtualizer>
    </section>
  );
}
