// Rivet-authored ListView demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { ListView } from "@rivetjs/ui/list-view";

export const head = { title: "ListView: Virtualized" };

// #region demo
const ROWS = Array.from({ length: 5000 }, (_, i) => ({ id: i, name: `Item ${i + 1}` }));

export function Virtualized() {
  return (
    <div id="lv-virtual" class="w-full max-w-md">
      <ListView aria-label="5000 items" items={ROWS} virtualized rowHeight={44} class="h-80 overflow-auto" initialSize={{ width: 448, height: 320 }}>
        {(row: { id: number; name: string }) => <ListView.Item textValue={row.name}>{row.name}</ListView.Item>}
      </ListView>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Virtualized />
    </div>
  );
}
