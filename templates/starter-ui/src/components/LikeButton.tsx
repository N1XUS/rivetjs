import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";

/** A @rivetjs/ui Button with a click count. Its code loads when you first point at it. */
export function LikeButton() {
  const likes = signal(0);
  return (
    <Button variant="primary" onPress={() => likes.update((n) => n + 1)}>
      Liked {likes()} times
    </Button>
  );
}
