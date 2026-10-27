import { signal } from "@rivetjs/reactivity";
import { CellSwitch } from "@rivetjs/ui/cell-switch";
import { EmojiReactionButton } from "@rivetjs/ui/emoji-reaction-button";
import { HoverCard } from "@rivetjs/ui/hover-card";

export const head = { title: "CellSwitch / HoverCard / EmojiReactionButton" };

// Rivet additions (feature sets inspired by HeroUI Pro's public docs): settings-row switch, hover preview card, emoji
// reaction toggle — each resumes on its first input.
export default function CellsOverlaysPro() {
  const wifi = signal(false);
  return (
    <main class="flex flex-col gap-8 bg-background p-6 text-foreground">
      <section class="flex max-w-sm flex-col gap-2">
        <div id="cs">
          <CellSwitch isSelected={wifi}>
            <CellSwitch.Trigger>
              <CellSwitch.Label>Wi-Fi</CellSwitch.Label>
              <CellSwitch.Control />
            </CellSwitch.Trigger>
          </CellSwitch>
        </div>
        <p id="cs-state">{() => (wifi() ? "on" : "off")}</p>
        <div id="cs-disabled">
          <CellSwitch isDisabled label="Hotspot" description="Managed" variant="secondary" />
        </div>
      </section>
      <p class="pt-40">
        Reviewed by{" "}
        <HoverCard openDelay={0} closeDelay={0}>
          <HoverCard.Trigger id="hc">@mara</HoverCard.Trigger>
          <HoverCard.Content id="hc-card" aria-label="Mara">
            <HoverCard.Arrow />
            <a id="hc-link" href="#profile">
              Profile
            </a>
          </HoverCard.Content>
        </HoverCard>{" "}
        <button type="button" id="after">
          After
        </button>
      </p>
      <div class="flex gap-2">
        <EmojiReactionButton id="erb" aria-label="Thumbs up">
          <EmojiReactionButton.Emoji>👍</EmojiReactionButton.Emoji>
          <EmojiReactionButton.Count>3</EmojiReactionButton.Count>
        </EmojiReactionButton>
        <EmojiReactionButton id="erb-ro" isReadOnly isSelected aria-label="Party">
          <EmojiReactionButton.Emoji>🎉</EmojiReactionButton.Emoji>
          <EmojiReactionButton.Count>9</EmojiReactionButton.Count>
        </EmojiReactionButton>
      </div>
    </main>
  );
}
