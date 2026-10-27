import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";

/** A @rivetjs/ui Button with a click count. The browser fetches its code when idle after load and runs it on the first press. */
export function LikeButton() {
  const likes = signal(0);
  return (
    <Button variant="primary" onPress={() => likes.update((n) => n + 1)}>
      Liked {likes()} times
    </Button>
  );
}
