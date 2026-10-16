import { useFocusRing } from "@rivetjs/cdk/focus-ring";
import { Search } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "useFocusRing" };

// #region demo
export default function Rings() {
  const button = useFocusRing();
  // within: the wrapper gets the ring while its input has keyboard focus.
  const search = useFocusRing({ within: true, isTextInput: true });
  return (
    <section class="m-4 flex flex-wrap items-center gap-3 text-sm">
      <button id="before" type="button" class="underline">
        Before
      </button>
      <button
        id="save"
        type="button"
        {...button.focusProps}
        data-focused={button.isFocused() || undefined}
        data-focus-visible={button.isFocusVisible() || undefined}
        class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-teal-700 data-[focus-visible]:ring-offset-2"
      >
        Save
      </button>
      <div
        id="search"
        {...search.focusProps}
        data-focus-visible={search.isFocusVisible() || undefined}
        class="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 data-[focus-visible]:border-teal-700 data-[focus-visible]:ring-2 data-[focus-visible]:ring-teal-700"
      >
        <Icon icon={Search} />
        <input id="query" aria-label="Search" class="outline-none" />
      </div>
    </section>
  );
}
// #endregion
