import { signal, computed } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Minus, Plus } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Computed total" };

interface Line {
  id: string;
  name: string;
  cents: number;
  qty: number;
}

// #region demo
export default function Cart() {
  const lines = signal<Line[]>([
    { id: "tea", name: "Green tea", cents: 440, qty: 1 },
    { id: "cake", name: "Lemon cake", cents: 880, qty: 1 },
  ]);
  // Computed values read other signals. They update only when what they read changes.
  const count = computed(() => lines().reduce((sum, line) => sum + line.qty, 0));
  const total = computed(() => lines().reduce((sum, line) => sum + line.cents * line.qty, 0));
  const money = (cents: number) => "$" + (cents / 100).toFixed(2);

  return (
    <div class="m-4 max-w-sm text-sm">
      <ul class="grid gap-2">
        <For each={lines} by={(line) => line.id}>
          {(line) => (
            <li class="flex items-center gap-2">
              <span class="flex-1">
                {line().name} · {money(line().cents)}
              </span>
              <button
                id={"remove-" + line().id}
                class="w-7 rounded border border-slate-300"
                aria-label={"One less " + line().name}
                onClick={() => lines.update((all) => all.map((l) => (l.id === line().id ? { ...l, qty: Math.max(0, l.qty - 1) } : l)))}
              >
                <Icon icon={Minus} />
              </button>
              <span class="w-6 text-center font-mono">{line().qty}</span>
              <button
                id={"add-" + line().id}
                class="w-7 rounded border border-slate-300"
                aria-label={"One more " + line().name}
                onClick={() => lines.update((all) => all.map((l) => (l.id === line().id ? { ...l, qty: l.qty + 1 } : l)))}
              >
                <Icon icon={Plus} />
              </button>
            </li>
          )}
        </For>
      </ul>
      <p class="mt-4 border-t border-slate-200 pt-3 font-semibold">
        {count()} items · <span id="total">{money(total())}</span>
      </p>
    </div>
  );
}
// #endregion
