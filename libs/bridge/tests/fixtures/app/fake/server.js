// Server adapter of the fake framework: a component's `html(props, slots)` is its server render.
export const adapter = {
  name: "fake",
  render(component, props, slots) {
    return component.html(props, slots);
  },
};
