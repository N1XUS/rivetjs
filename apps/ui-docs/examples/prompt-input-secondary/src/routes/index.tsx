// Rivet-authored PromptInput demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { PromptInput } from "@rivetjs/ui/prompt-input";

export const head = { title: "PromptInput: Secondary" };

// #region demo
export function Secondary() {
  return (
    <div class="flex w-[32rem] flex-col gap-4">
      {(["sm", "md", "lg"] as const).map((size) => (
        <PromptInput variant="secondary" size={size}>
          <PromptInput.Shell>
            <PromptInput.Content>
              <PromptInput.TextArea placeholder={`Size ${size}`} />
            </PromptInput.Content>
            <PromptInput.Toolbar>
              <PromptInput.ToolbarEnd>
                <PromptInput.Send />
              </PromptInput.ToolbarEnd>
            </PromptInput.Toolbar>
          </PromptInput.Shell>
        </PromptInput>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Secondary />
    </div>
  );
}
