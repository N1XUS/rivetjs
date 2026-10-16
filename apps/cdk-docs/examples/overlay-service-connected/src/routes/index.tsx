import { Dropdown } from "../components/Dropdown.tsx";

export const head = { title: "Overlay service: connected position" };

export default function Page() {
  return (
    <section class="m-4 grid justify-items-start gap-3 text-sm">
      <h2 id="oc-heading" class="font-semibold">
        Sort
      </h2>
      <Dropdown />
    </section>
  );
}
