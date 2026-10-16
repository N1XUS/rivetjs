import { RadioGroup } from "@rivetjs/cdk/radio-group";

export const head = { title: "Horizontal and RTL RadioGroup" };

// #region demo
export default function Orientation() {
  return (
    <section class="m-4 grid max-w-md gap-4 text-sm">
      <RadioGroup
        id="align"
        label="Alignment"
        orientation="horizontal"
        defaultValue="left"
        items={[
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ]}
      />
      {/* Native radios follow the writing direction: in RTL, ArrowLeft is "next". */}
      <div dir="rtl">
        <RadioGroup
          id="rtl"
          label="اختيار"
          orientation="horizontal"
          defaultValue="a"
          items={[
            { value: "a", label: "أ" },
            { value: "b", label: "ب" },
            { value: "c", label: "ج" },
          ]}
        />
      </div>
    </section>
  );
}
// #endregion
