// Cold visual states (ZERO ONDEMAND): Button / CloseButton / PromptSuggestion item WITH press handlers. Before the first
// interaction no ui / cdk JS has loaded, so hover / press / focus-visible come from the stylesheet's `:hover` / `:active` /
// `:focus-visible`; after the adopt run the same pixels come from `data-hovered` / `data-pressed` / `data-focus-visible`.
// The tall spacer lets a touch drag scroll the page (press cancel).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { CloseButton } from "@rivetjs/ui/close-button";
import { PromptSuggestion } from "@rivetjs/ui/prompt-suggestion";

export default function ColdStates() {
  const pressed = signal(0);
  const closed = signal(0);
  const picked = signal("");
  return (
    <main class="flex flex-col items-start gap-6 p-8">
      <Button id="cs-button" onPress={() => pressed.set(pressed() + 1)}>
        Press me
      </Button>
      <output id="cs-pressed">{pressed()}</output>
      <CloseButton id="cs-close" onPress={() => closed.set(closed() + 1)} />
      <output id="cs-closed">{closed()}</output>
      <PromptSuggestion>
        <PromptSuggestion.Items>
          <PromptSuggestion.Item id="cs-suggest" onPress={() => picked.set("trip")}>
            Plan a weekend trip
          </PromptSuggestion.Item>
        </PromptSuggestion.Items>
      </PromptSuggestion>
      <output id="cs-picked">{picked()}</output>
      <div style={{ height: "2000px" }} />
    </main>
  );
}
