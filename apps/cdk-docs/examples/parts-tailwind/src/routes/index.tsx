import { Heading } from "@rivetjs/cdk/heading";
import { Separator } from "@rivetjs/cdk/separator";
import { Keyboard } from "@rivetjs/cdk/keyboard";
import { Input } from "@rivetjs/cdk/input";

export const head = { title: "Parts with Tailwind" };

// #region demo
export default function PartsTailwind() {
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <Heading id="tw-heading" class="rv-Heading m-0 text-lg font-semibold text-slate-900">
        Search
      </Heading>
      <Separator class="m-0 border-0 border-t border-slate-200" />
      <Input
        id="tw-input"
        aria-label="Query"
        placeholder="Type to search"
        class="rounded-md border border-slate-300 px-2 py-1 outline-none hovered:border-slate-400 focused:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-200"
      />
      <p class="m-0 text-slate-500">
        Open with <Keyboard class="rounded border border-slate-300 px-1.5 font-mono text-xs">Ctrl+K</Keyboard>
      </p>
    </div>
  );
}
// #endregion
