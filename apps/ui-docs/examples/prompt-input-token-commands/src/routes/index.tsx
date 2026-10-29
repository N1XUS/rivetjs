// Rivet-authored PromptInput demo (Rivet addition; "Token Input" section of HeroUI Pro's public docs, own content).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import {
  PromptInputTokenInput,
  PromptInputTokenSuggestion,
  PromptInputTokenSuggestions,
  PromptInputTokens,
  usePromptInputTokens,
} from "@rivetjs/ui/prompt-input-tokens";
import { FileCode, FileText, Languages, ListChecks, Paperclip, Sparkles } from "lucide";

export const head = { title: "PromptInput: Commands and files" };

// #region demo
const COMMANDS = [
  { id: "summarize", label: "Summarize", hint: "Condense the thread", icon: Sparkles },
  { id: "translate", label: "Translate", hint: "Into another language", icon: Languages },
  { id: "todo", label: "To-do list", hint: "Turn notes into tasks", icon: ListChecks },
];
const FILES = [
  { id: "readme.md", icon: FileText },
  { id: "router.ts", icon: FileCode },
  { id: "release-notes.md", icon: FileText },
];

export function Commands() {
  const tokens = usePromptInputTokens({ triggers: ["/", "@"] });
  const sent = signal("");
  const commands = () => COMMANDS.filter((command) => command.id.startsWith(tokens.query().toLowerCase()));
  const files = () => FILES.filter((file) => file.id.includes(tokens.query().toLowerCase()));
  return (
    <div class="flex w-[34rem] flex-col gap-3">
      <output id="commands-sent" class="text-sm text-muted">
        {sent() ? `Sent: ${sent()}` : "Type / for a command or @ for a file."}
      </output>
      <PromptInput layout="compact" onSubmit={(text) => sent.set(text)}>
        <PromptInput.Shell>
          <PromptInputTokens tokens={tokens}>
            <PromptInput.Content>
              <PromptInputTokenInput id="commands-text" placeholder="Ask, / for commands, @ for files" />
            </PromptInput.Content>
            {/* Docked at the bottom of a page: open upward over the content. */}
            <PromptInputTokenSuggestions placement="top start" aria-label={tokens.trigger() === "@" ? "Files" : "Commands"}>
              <For each={() => (tokens.trigger() === "/" ? commands() : [])} by={(command: (typeof COMMANDS)[number]) => command.id}>
                {(command: () => (typeof COMMANDS)[number]) => (
                  <PromptInputTokenSuggestion id={command().id} token={`/${command().id}`}>
                    <Icon icon={command().icon} size={16} class="text-muted" />
                    <span class="flex-1">{command().label}</span>
                    <span class="text-xs text-muted">{command().hint}</span>
                  </PromptInputTokenSuggestion>
                )}
              </For>
              <For each={() => (tokens.trigger() === "@" ? files() : [])} by={(file: (typeof FILES)[number]) => file.id}>
                {(file: () => (typeof FILES)[number]) => (
                  <PromptInputTokenSuggestion id={file().id} token={`@${file().id}`}>
                    <Icon icon={file().icon} size={16} class="text-muted" />
                    <span class="font-mono text-xs">{file().id}</span>
                  </PromptInputTokenSuggestion>
                )}
              </For>
            </PromptInputTokenSuggestions>
          </PromptInputTokens>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarStart>
              <PromptInput.Action aria-label="Attach files" tooltip="Attach files">
                <Icon icon={Paperclip} size={16} />
              </PromptInput.Action>
            </PromptInput.ToolbarStart>
            <PromptInput.ToolbarEnd>
              <PromptInput.Send />
            </PromptInput.ToolbarEnd>
          </PromptInput.Toolbar>
        </PromptInput.Shell>
      </PromptInput>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-end justify-center p-6 pb-10 [:where(&>*)]:max-w-full">
      <Commands />
    </div>
  );
}
