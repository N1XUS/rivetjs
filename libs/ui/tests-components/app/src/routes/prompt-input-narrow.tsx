// PromptInput at phone width (FIX-UI 2026-11-01): `#pn-review` review composer (chip + checkbox label + Approve + Send in
// one toolbar), `#pn-queue` queue rows (content + description + attachments overflow + actions), `#pn-basic` plain composer.
// `prompt-input-narrow.test.ts` checks the boxes at 320 / 390 px (narrow container) and 1280 px (one-row toolbar, as before).
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Chip } from "@rivetjs/ui/chip";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import { Check, GitPullRequest } from "lucide";

export default function PromptInputNarrow() {
  return (
    <section class="flex w-[34rem] max-w-full flex-col gap-8 p-4">
      <PromptInput id="pn-review" aria-label="Review follow-up">
        <PromptInput.Shell>
          <PromptInput.Content>
            <PromptInput.TextArea placeholder="Ask for changes to this pull request…" />
          </PromptInput.Content>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarStart>
              <Chip size="sm" variant="soft">
                <Icon icon={GitPullRequest} size={14} />
                #482 · 3 files
              </Chip>
              <Checkbox id="pn-commit" defaultSelected class="text-sm">
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <span id="pn-commit-label">Commit when done</span>
                </Checkbox.Content>
              </Checkbox>
            </PromptInput.ToolbarStart>
            <PromptInput.ToolbarEnd>
              <Button size="sm" variant="secondary">
                <Icon icon={Check} size={14} />
                Approve
              </Button>
              <PromptInput.Send />
            </PromptInput.ToolbarEnd>
          </PromptInput.Toolbar>
        </PromptInput.Shell>
      </PromptInput>
      <PromptInput id="pn-queue" aria-label="Queue" status="streaming" lockInputOnRun={false}>
        <PromptInput.Queue>
          <PromptInput.Queue.List>
            <PromptInput.Queue.Item>
              <PromptInput.Queue.Item.Icon />
              <PromptInput.Queue.Item.Body>
                <PromptInput.Queue.Item.Content>Now add error handling to every request</PromptInput.Queue.Item.Content>
                <PromptInput.Queue.Item.Description>Runs after the current answer</PromptInput.Queue.Item.Description>
                <PromptInput.Queue.Item.Attachments>
                  <PromptInput.Queue.Item.AttachmentsOverflow hiddenCount={2} />
                </PromptInput.Queue.Item.Attachments>
              </PromptInput.Queue.Item.Body>
              <PromptInput.Queue.Item.Actions>
                <PromptInput.Queue.Item.Remove />
              </PromptInput.Queue.Item.Actions>
            </PromptInput.Queue.Item>
          </PromptInput.Queue.List>
        </PromptInput.Queue>
        <PromptInput.Shell>
          <PromptInput.Content>
            <PromptInput.TextArea placeholder="Queue another prompt" />
          </PromptInput.Content>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarEnd>
              <PromptInput.Send />
            </PromptInput.ToolbarEnd>
          </PromptInput.Toolbar>
        </PromptInput.Shell>
      </PromptInput>
    </section>
  );
}
