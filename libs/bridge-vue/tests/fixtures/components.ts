import { defineComponent, h, inject, onUnmounted, ref, Teleport, useId } from "vue";

export const lifecycle = { unmounted: 0 };
export const Counter = defineComponent({
  props: { count: Number, label: String, onIncrement: Function },
  setup(props) {
    const local = ref(0);
    const id = useId();
    onUnmounted(() => lifecycle.unmounted++);
    return () =>
      h("article", { id }, [
        h("span", { class: "count" }, props.count),
        h("span", { class: "label" }, props.label ?? "absent"),
        h(
          "button",
          {
            class: "inc",
            onClick() {
              local.value++;
              props.onIncrement?.(1);
            },
          },
          String(local.value),
        ),
      ]);
  },
});
export const Card = defineComponent({
  props: { tone: String },
  setup(props, { slots }) {
    return () => h("article", { class: props.tone }, [h("header", slots["section-title"]?.()), h("section", slots.default?.())]);
  },
});
export const AsyncCard = defineComponent({
  async setup() {
    await Promise.resolve();
    return () => h("b", "resolved");
  },
});
export const Boom = defineComponent({
  setup() {
    throw new Error("vue boom");
  },
});
export const AsyncBoom = defineComponent({
  async setup() {
    await Promise.resolve();
    throw new Error("vue async boom");
  },
});
export const Injected = defineComponent({
  setup() {
    const value = inject("value");
    return () => h("b", String(value));
  },
});
export const Head = defineComponent({
  setup() {
    return () =>
      h("section", [h(Teleport, { to: "head" }, [h("title", "Vue & Rivet"), h("meta", { name: "description", content: "island" })]), h("p", "body")]);
  },
});

export const hydrationAttempt = { count: 0 };
export const HydrateOnce = defineComponent({
  setup(_, { slots }) {
    if (hydrationAttempt.count++ === 0) throw new Error("first hydration failed");
    return () => h("div", { class: "recovered" }, slots.default?.());
  },
});

const metaTree = (props: { name?: string; content?: string }) =>
  h("section", [h(Teleport, { to: "head" }, [h("meta", { name: props.name, content: props.content })]), h("p", "body")]);
export const HeadMeta = defineComponent({
  props: { name: String, content: String },
  setup(props) {
    return () => metaTree(props);
  },
});
export const AsyncHeadMeta = defineComponent({
  props: { name: String, content: String },
  async setup(props) {
    await new Promise((done) => setTimeout(done, 5));
    return () => metaTree(props);
  },
});

export const asyncFailure = { unmounted: 0, wait: Promise.resolve() as Promise<void> };
export const RejectingAsync = defineComponent({
  async setup() {
    onUnmounted(() => asyncFailure.unmounted++);
    await asyncFailure.wait;
    throw new Error("async readiness rejected");
  },
});

export const nativeRetry = { attempts: 0, unmounted: 0 };
export const RetryHead = defineComponent({
  props: { name: String, content: String },
  async setup(props) {
    onUnmounted(() => nativeRetry.unmounted++);
    await Promise.resolve();
    if (nativeRetry.attempts++ === 0) throw new Error("native setup retries");
    return () => metaTree(props);
  },
});
