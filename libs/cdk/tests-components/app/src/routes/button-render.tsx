import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";

export const head = { title: "Button render" };

// `render` (RAC DOMRenderProps) with an inline arrow on a resumed page: press + reactive class / data-pressed.
export default function ButtonRenderStory() {
  const log = signal<string[]>([]);
  return (
    <section>
      <h1>Button render</h1>
      <Button
        id="rb"
        class={({ isPressed }) => (isPressed() ? "on" : "off")}
        onPress={() => log.update((l) => [...l, "press"])}
        render={(props) => <button {...(props as {})} data-r="1" />}
      >
        Render
      </Button>
      <p id="rb-log">{log().join(" ")}</p>
    </section>
  );
}
