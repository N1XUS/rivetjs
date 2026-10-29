// Rivet-authored PromptInput demo (Rivet addition; feature scope from public docs of commercial UI kits, own content).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Chip } from "@rivetjs/ui/chip";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import { Check, GitPullRequest } from "lucide";

export const head = { title: "PromptInput: Review composer" };

// #region demo
export function ReviewComposer() {
  const commit = signal(true);
  const log = signal("Waiting for review");
  return (
    <div class="flex w-[34rem] flex-col gap-3">
      <PromptInput onSubmit={(text) => log.set(`Follow-up requested: ${text}${commit() ? " (then commit)" : ""}`)} aria-label="Review follow-up">
        <PromptInput.Shell>
          <PromptInput.Content>
            <PromptInput.TextArea id="review-text" placeholder="Ask for changes to this pull request…" />
          </PromptInput.Content>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarStart>
              <Chip size="sm" variant="soft">
                <Icon icon={GitPullRequest} size={14} />
                #482 · 3 files
              </Chip>
              <Checkbox id="review-commit" isSelected={commit} class="text-sm">
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  Commit when done
                </Checkbox.Content>
              </Checkbox>
            </PromptInput.ToolbarStart>
            <PromptInput.ToolbarEnd>
              <Button id="review-approve" size="sm" variant="secondary" onPress={() => log.set("Approved #482")}>
                <Icon icon={Check} size={14} />
                Approve
              </Button>
              <PromptInput.Send id="review-send" />
            </PromptInput.ToolbarEnd>
          </PromptInput.Toolbar>
        </PromptInput.Shell>
      </PromptInput>
      <output id="review-log" class="text-sm text-muted">
        {log()}
      </output>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ReviewComposer />
    </div>
  );
}
