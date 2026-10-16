// Rivet-authored Masonry demo (Rivet addition, no HeroUI counterpart): multiple selection over product photos.
import { signal } from "@rivetjs/reactivity";
import { Masonry, type Selection } from "@rivetjs/ui/masonry";
import beanie from "../assets/shop-beanie.jpg?image";
import lamp from "../assets/shop-lamp.jpg?image";
import mug from "../assets/shop-mug.jpg?image";
import runner from "../assets/shop-runner.jpg?image";
import shirt from "../assets/shop-shirt.jpg?image";
import tote from "../assets/shop-tote.jpg?image";

export const head = { title: "Masonry: Selection" };

const products = [
  { id: "shop-mug", name: "Mug", image: mug },
  { id: "shop-lamp", name: "Lamp", image: lamp },
  { id: "shop-tote", name: "Tote bag", image: tote },
  { id: "shop-beanie", name: "Beanie", image: beanie },
  { id: "shop-runner", name: "Runner", image: runner },
  { id: "shop-shirt", name: "Shirt", image: shirt },
].map((p) => ({ ...p, aspectRatio: p.image.width / p.image.height }));

// #region demo
export function MasonrySelection() {
  const selected = signal<Selection>(new Set());
  return (
    <div class="flex w-[min(40rem,100%)] flex-col gap-3">
      <p id="masonry-selection-count" class="text-sm text-muted">
        {(() => {
          const s = selected();
          return s === "all" ? "All selected" : `${s.size} selected`;
        })()}
      </p>
      <Masonry id="masonry-selection" items={products} columns={3} gap={12} aria-label="Products" selectionMode="multiple" selectedKeys={selected}>
        {(product) => <img src={product.image.src} alt={product.name} loading="lazy" draggable={false} />}
      </Masonry>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-start justify-center p-6 [:where(&>*)]:max-w-full">
      <MasonrySelection />
    </div>
  );
}
