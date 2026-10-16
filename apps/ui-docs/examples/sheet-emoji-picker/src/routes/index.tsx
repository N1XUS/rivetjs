// Rivet-authored Sheet demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";
import { Flame, Heart, Laugh, PartyPopper, Smile, Star, ThumbsDown, ThumbsUp } from "lucide";

export const head = { title: "Sheet: Emoji Picker Sheet" };

// #region demo
const REACTIONS = [
  { id: "like", label: "Like", icon: ThumbsUp },
  { id: "love", label: "Love", icon: Heart },
  { id: "laugh", label: "Laugh", icon: Laugh },
  { id: "smile", label: "Smile", icon: Smile },
  { id: "fire", label: "Fire", icon: Flame },
  { id: "star", label: "Star", icon: Star },
  { id: "party", label: "Party", icon: PartyPopper },
  { id: "dislike", label: "Dislike", icon: ThumbsDown },
];

export function ReactionPicker() {
  const picked = signal("none");
  return (
    <div class="flex flex-col items-center gap-3">
      <Sheet>
        <Button variant="secondary">React</Button>
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog aria-label="Pick a reaction">
              <Sheet.Handle />
              <Sheet.Body>
                <div class="grid grid-cols-4 gap-2">
                  {REACTIONS.map((reaction) => (
                    <Button slot="close" variant="ghost" class="h-16 flex-col gap-1" onPress={() => picked.set(reaction.label)}>
                      <Icon icon={reaction.icon} size={22} />
                      <span class="text-xs">{reaction.label}</span>
                    </Button>
                  ))}
                </div>
              </Sheet.Body>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
      <p class="text-sm text-muted">
        Reaction: <span id="sheet-emoji-picked">{picked()}</span>
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ReactionPicker />
    </div>
  );
}
