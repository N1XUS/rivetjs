import { signal } from "@rivetjs/reactivity";
import { Collection } from "@rivetjs/cdk/collections/components";
import { Header } from "@rivetjs/cdk/header";
import { ListBox, ListBoxItem, ListBoxSection, type Key, type Selection } from "@rivetjs/cdk/listbox";
import { Text } from "@rivetjs/cdk/text";

export const head = { title: "ListBox sections" };

interface Dish {
  key: string;
  label: string;
  description?: string;
}
interface MenuSection {
  key: string;
  title?: string;
  "aria-label"?: string;
  children: Dish[];
}

// Sections render as ListBoxSection + Header; items as ListBoxItem with label / description Text slots.
const menu: MenuSection[] = [
  {
    key: "starters",
    title: "Starters",
    children: [
      { key: "soup", label: "Soup", description: "Tomato and basil" },
      { key: "salad", label: "Salad", description: "Greens, lemon dressing" },
    ],
  },
  {
    key: "mains",
    title: "Mains",
    children: [
      { key: "risotto", label: "Risotto", description: "Mushroom" },
      { key: "curry", label: "Curry", description: "Chickpea, coconut" },
    ],
  },
  // No title: name the group with aria-label.
  { key: "extras", "aria-label": "Extras", children: [{ key: "bread", label: "Bread" }] },
];

const show = (keys: Selection) => (keys === "all" ? "all" : [...keys].map(String).sort().join(", ") || "none");

// #region demo
export default function Order() {
  const order = signal<Selection>(new Set<Key>());
  return (
    <section class="m-4 grid max-w-xs gap-2 text-sm">
      <ListBox id="order" aria-label="Order" items={menu} selectionMode="multiple" selectedKeys={order}>
        {(section: MenuSection) => (
          <ListBoxSection id={section.key} aria-label={section["aria-label"]}>
            {section.title ? <Header>{section.title}</Header> : null}
            <Collection items={section.children}>
              {(dish: Dish) => (
                <ListBoxItem id={dish.key} textValue={dish.label}>
                  <Text slot="label">{dish.label}</Text>
                  {dish.description ? <Text slot="description">{dish.description}</Text> : null}
                </ListBoxItem>
              )}
            </Collection>
          </ListBoxSection>
        )}
      </ListBox>
      <p id="order-value" class="text-slate-600">
        Order: {show(order())}
      </p>
    </section>
  );
}
// #endregion
