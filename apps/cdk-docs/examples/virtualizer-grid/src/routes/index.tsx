import { signal } from "@rivetjs/reactivity";
import { Virtualizer, GridLayout, type Size } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: grid" };

const photos = Array.from({ length: 600 }, (_, i) => ({ id: i, hue: (i * 37) % 360 }));

// #region demo
export default function Photos() {
  const top = signal(0);
  return (
    <section class="stack">
      <button
        id="photos-bottom"
        type="button"
        onClick={() => {
          const scroller = document.getElementById("photos")!;
          scroller.scrollTop = scroller.scrollHeight;
        }}
      >
        Bottom
      </button>
      <Virtualizer
        id="photos"
        role="grid"
        label="Photos"
        tabIndex={0}
        items={photos}
        layout={() => new GridLayout()}
        // Sizes are plain JSON objects (they are resumed); the layout reads width / height only.
        layoutOptions={{ minItemSize: { width: 88, height: 88 } as Size, minSpace: { width: 8, height: 8 } as Size, preserveAspectRatio: true, maxColumns: 4 }}
        initialSize={{ width: 320, height: 240 }}
        style={{ width: "320px", height: "240px" }}
        onScroll={(event) => top.set((event.currentTarget as HTMLElement).scrollTop)}
      >
        {(photo) => (
          <div role="gridcell" class="tile" style={{ background: `hsl(${photo().hue} 70% 85%)` }}>
            {photo().id}
          </div>
        )}
      </Virtualizer>
      <output id="photos-top">scrollTop: {top()}</output>
    </section>
  );
}
// #endregion
