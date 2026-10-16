import { Group } from "@rivetjs/cdk/group";

export const head = { title: "Group with Tailwind" };

// #region demo
const group =
  "flex w-64 items-center overflow-hidden rounded-md border border-slate-300 text-sm transition " +
  "data-[focus-within]:border-teal-600 data-[focus-visible]:ring-2 data-[focus-visible]:ring-teal-500/40 " +
  "data-[invalid]:border-red-600 data-[disabled]:opacity-50";

export default function Price() {
  return (
    <div class="m-4 grid gap-3">
      <Group id="tw-price" aria-label="Price" class={group}>
        <span class="bg-slate-100 px-2 py-1.5 text-slate-500">€</span>
        <input id="tw-price-input" aria-label="Amount" inputMode="decimal" class="min-w-0 flex-1 px-2 py-1.5 outline-none" />
      </Group>
      <Group id="tw-price-bad" aria-label="Invalid price" isInvalid class={group}>
        <span class="bg-slate-100 px-2 py-1.5 text-slate-500">€</span>
        <input aria-label="Amount" value="-3" class="min-w-0 flex-1 px-2 py-1.5 outline-none" />
      </Group>
    </div>
  );
}
// #endregion
