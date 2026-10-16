import { FilterButton } from "../components/FilterButton.tsx";

export const head = { title: "Custom overlay" };

export default function Shop() {
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <h2 id="heading" class="font-semibold">
        Products
      </h2>
      <FilterButton />
    </section>
  );
}
