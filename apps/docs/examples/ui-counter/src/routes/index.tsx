import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";

export default function Counter() {
  const count = signal(0);
  const add = () => count.update((n) => n + 1);
  const reset = () => count.set(0);
  return (
    <div class="counter">
      <output aria-live="polite">{count()}</output>
      <Button onPress={add}>Increment</Button>
      <Button variant="ghost" isDisabled={count() === 0} onPress={reset}>
        Reset
      </Button>
    </div>
  );
}
