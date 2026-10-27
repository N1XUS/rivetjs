import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";

/** A @rivetjs/ui Button with a click count. The default loader fetches code ahead at idle; the component adopts its HTML on first use. */
export function LikeButton() {
  const likes = signal(0);
  return (
    <Button variant="primary" onPress={() => likes.update((n) => n + 1)}>
      Liked {likes()} times
    </Button>
  );
}
