// Compare on a resumed page (Rivet addition; behaviour `@rivetjs/cdk/compare`): `#cmp` horizontal with labels (onChange
// readout `#cmp-value`, onChangeEnd count `#cmp-ends`); `#cmp-v` vertical; `#cmp-any` dragAnywhere; `#cmp-ctl` controlled
// by a Signal (`#cmp-ctl-value` readout, `#cmp-ctl-set` sets 80); `#cmp-off` isDisabled.
import { signal } from "@rivetjs/reactivity";
import { Compare } from "@rivetjs/ui/compare";

export default function CompareStories() {
  const value = signal(50);
  const ends = signal(0);
  const ctl = signal(30);
  return (
    <main class="flex flex-col items-center gap-8 p-6">
      <p>
        <span id="cmp-value">{value()}</span> / <span id="cmp-ends">{ends()}</span>
      </p>
      <Compare id="cmp" class="h-60 w-full max-w-[480px]" onChange={(v: number) => value.set(v)} onChangeEnd={() => ends.set(ends() + 1)}>
        <Compare.Before class="bg-[#1e3a8a]">
          <Compare.Label placement="start">Before</Compare.Label>
        </Compare.Before>
        <Compare.After class="bg-[#f59e0b]">
          <Compare.Label placement="end">After</Compare.Label>
        </Compare.After>
        <Compare.Handle id="cmp-handle" />
      </Compare>
      <Compare id="cmp-v" orientation="vertical" defaultValue={25} class="h-60 w-full max-w-[480px]">
        <Compare.Before class="bg-[#065f46]" />
        <Compare.After class="bg-[#fda4af]" />
        <Compare.Handle id="cmp-v-handle" />
      </Compare>
      <Compare id="cmp-any" dragAnywhere class="h-40 w-full max-w-[480px]">
        <Compare.Before class="bg-[#334155]" />
        <Compare.After class="bg-[#e2e8f0]" />
        <Compare.Handle id="cmp-any-handle" />
      </Compare>
      <p id="cmp-ctl-value">{ctl()}</p>
      <button id="cmp-ctl-set" type="button" onClick={() => ctl.set(80)}>
        Set 80
      </button>
      <Compare id="cmp-ctl" value={ctl} class="h-40 w-full max-w-[480px]">
        <Compare.Before class="bg-[#7c2d12]" />
        <Compare.After class="bg-[#bae6fd]" />
        <Compare.Handle id="cmp-ctl-handle" />
      </Compare>
      <Compare id="cmp-off" isDisabled class="h-24 w-full max-w-[480px]">
        <Compare.Before class="bg-[#111827]" />
        <Compare.After class="bg-[#f3f4f6]" />
        <Compare.Handle id="cmp-off-handle" />
      </Compare>
    </main>
  );
}
