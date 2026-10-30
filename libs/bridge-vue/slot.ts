// Vue owns only the slot hole. Rivet owns its children: a constant innerHTML opts out of Vue child reconciliation.
import { defineComponent, h, onMounted, onUpdated, ref, type PropType, type Slots, type VNode } from "vue";

export const Slot = defineComponent({
  name: "RivetSlot",
  props: { name: { type: String, required: true }, nodes: Array as PropType<Node[] | null> },
  setup(props) {
    const hole = ref<HTMLElement>();
    const adopt = () => {
      const element = hole.value;
      if (element && props.nodes?.length && props.nodes.some((node) => node.parentNode !== element)) element.append(...props.nodes);
    };
    onMounted(adopt);
    onUpdated(adopt);
    return () => h("rivet-slot", { ref: hole, name: props.name === "default" ? undefined : props.name, style: "display:contents", innerHTML: "" });
  },
});

/** Names stay unchanged: Vue uses render functions for both default and named slots. */
export function withSlots(names: readonly string[], nodes?: Record<string, Node[] | null>): Slots {
  const slots: Record<string, () => VNode[]> = Object.create(null);
  for (const name of names) slots[name] = () => [h(Slot, { name, nodes: nodes?.[name] ?? null })];
  return slots;
}
