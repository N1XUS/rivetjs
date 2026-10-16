import { Toolbar } from "../components/Toolbar.tsx";

export const head = { title: "Toolbar with roving focus" };

export default function Editor() {
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <Toolbar id="format" label="Format" />
      {/* In right-to-left text ArrowLeft moves forward. */}
      <div dir="rtl">
        <Toolbar id="rtl" label="Format (right-to-left)" />
      </div>
    </section>
  );
}
