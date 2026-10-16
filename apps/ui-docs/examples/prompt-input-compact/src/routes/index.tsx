// Rivet-authored PromptInput demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import { Plus } from "lucide";

export const head = { title: "PromptInput: Compact" };

// #region demo
export function Compact() {
  return (
    <PromptInput layout="compact" class="w-[30rem]">
      <PromptInput.Shell>
        <PromptInput.Content>
          <PromptInput.TextArea id="compact-text" placeholder="Ask anything" />
        </PromptInput.Content>
        <PromptInput.Toolbar>
          <PromptInput.ToolbarStart>
            <PromptInput.Action aria-label="Add">
              <Icon icon={Plus} size={16} />
            </PromptInput.Action>
          </PromptInput.ToolbarStart>
          <PromptInput.ToolbarEnd>
            <PromptInput.Send />
          </PromptInput.ToolbarEnd>
        </PromptInput.Toolbar>
      </PromptInput.Shell>
    </PromptInput>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Compact />
    </div>
  );
}
