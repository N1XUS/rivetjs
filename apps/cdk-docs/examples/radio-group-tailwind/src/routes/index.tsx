import { RadioGroup } from "@rivetjs/cdk/radio-group";

export const head = { title: "RadioGroup with Tailwind" };

// #region demo
export default function Segmented() {
  return (
    <RadioGroup
      id="tw-view"
      aria-label="View"
      orientation="horizontal"
      defaultValue="week"
      class="m-4 inline-flex rounded-lg bg-slate-100 p-1 text-sm orientation-vertical:flex-col"
      itemClass={
        "cursor-pointer rounded-md px-3 py-1 text-slate-600 transition " +
        "data-[selected]:bg-white data-[selected]:text-slate-900 data-[selected]:shadow " +
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-500"
      }
      inputClass="sr-only"
      items={[
        { value: "week", label: "Week" },
        { value: "month", label: "Month" },
        { value: "year", label: "Year" },
      ]}
    />
  );
}
// #endregion
