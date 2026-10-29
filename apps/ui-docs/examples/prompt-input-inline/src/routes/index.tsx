// Rivet-authored PromptInput demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import { Mic, Paperclip } from "lucide";

export const head = { title: "PromptInput: Inline" };

// #region demo
export function Inline() {
  return (
    <PromptInput layout="inline" class="w-[32rem]">
      <PromptInput.Shell>
        <PromptInput.Toolbar>
          <PromptInput.ToolbarStart>
            <PromptInput.Action aria-label="Attach">
              <Icon icon={Paperclip} size={16} />
            </PromptInput.Action>
          </PromptInput.ToolbarStart>
        </PromptInput.Toolbar>
        <PromptInput.Content>
          <PromptInput.TextArea placeholder="Message" />
        </PromptInput.Content>
        <PromptInput.Toolbar>
          <PromptInput.ToolbarEnd>
            <PromptInput.Action aria-label="Dictate">
              <Icon icon={Mic} size={16} />
            </PromptInput.Action>
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
      <Inline />
    </div>
  );
}
