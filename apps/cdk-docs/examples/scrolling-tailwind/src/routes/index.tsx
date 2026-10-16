import { createVirtualScroll, CdkVirtualScrollViewport } from "@rivetjs/cdk/scrolling";

export const head = { title: "Virtual scroll: Tailwind" };

const contacts = Array.from({ length: 1000 }, (_, i) => ({ name: `Contact ${i}`, email: `contact${i}@example.com` }));

// #region demo
export default function Contacts() {
  const state = createVirtualScroll({ id: "tw-vp", items: contacts, itemSize: 48, initialViewportSize: 240 });
  return (
    <section class="m-4 text-sm text-slate-900">
      <CdkVirtualScrollViewport state={state} label="Contacts" class="h-60 w-80 rounded-xl border border-slate-200 bg-white shadow-sm">
        {(contact, ctx) => (
          <div
            data-index={ctx.index()}
            data-odd={String(ctx.odd())}
            data-first={String(ctx.first())}
            data-last={String(ctx.last())}
            class="flex h-12 flex-col justify-center border-b border-slate-100 px-3 data-[last=true]:border-b-0 data-[odd=true]:bg-slate-50"
          >
            <span class="font-medium">{contact().name}</span>
            <span class="text-xs text-slate-500">{contact().email}</span>
          </div>
        )}
      </CdkVirtualScrollViewport>
    </section>
  );
}
// #endregion
