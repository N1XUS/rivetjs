import { Select } from "@rivetjs/cdk/select";

export const head = { title: "Select sections" };

const food = [
  {
    key: "fruit",
    title: "Fruit",
    children: [
      { key: "apple", label: "Apple" },
      { key: "banana", label: "Banana" },
    ],
  },
  {
    key: "veg",
    title: "Vegetables",
    children: [
      { key: "carrot", label: "Carrot" },
      { key: "leek", label: "Leek" },
    ],
  },
];

// #region demo
export default function Food() {
  // Sections: { key, title, children }; a section without a title takes an aria-label.
  return (
    <section class="m-4 grid max-w-xs gap-3 text-sm">
      <Select id="food" label="Ingredient" items={food} />
    </section>
  );
}
// #endregion
