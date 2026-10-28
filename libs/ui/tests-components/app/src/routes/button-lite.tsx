// PRESS-LITE: Buttons whose call sites the build proves need no press machinery (`onPress` that never reads its event,
// constant style props, live `isDisabled`, nothing above or inside that a ButtonRoot reads; `libs/compiler/native-lite.ts`)
// render the native twin (`button-lite.tsx`): a `<button onClick>` on a page that ships no cdk press / focus-visible code.
// Nothing else on this page may import the cdk Button (page scope).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";

export default function ButtonLiteStories() {
  const count = signal(0);
  const add = () => count.update((n) => n + 1);
  return (
    <main>
      <Button id="bl-inc" onPress={add}>
        Increment
      </Button>
      <output id="bl-count">{count()}</output>
      <Button id="bl-reset" variant="ghost" isDisabled={count() === 0} onPress={() => count.set(0)}>
        Reset
      </Button>
    </main>
  );
}
