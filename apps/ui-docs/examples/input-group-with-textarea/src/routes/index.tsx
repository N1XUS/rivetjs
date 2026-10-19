// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/with-textarea.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { ArrowUp, AtSign, Mic, Plug, Plus } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Kbd } from "@rivetjs/ui/kbd";
import { Spinner } from "@rivetjs/ui/spinner";
import { TextField } from "@rivetjs/ui/textfield";
import { Tooltip } from "@rivetjs/ui/tooltip";

export const head = { title: "InputGroup: With TextArea" };

// #region demo
export function WithTextArea() {
  const value = signal("");
  const isSubmitting = signal(false);

  const handleSubmit = () => {
    if (!value().trim()) return;

    isSubmitting.set(true);

    setTimeout(() => {
      isSubmitting.set(false);
      value.set("");
    }, 1000);
  };

  return (
    <TextField fullWidth aria-label="Prompt input" class="flex w-sm flex-col sm:w-lg" name="prompt" value={value}>
      <InputGroup fullWidth class="flex flex-col gap-2 rounded-3xl py-2">
        <InputGroup.Prefix class="px-3 py-0">
          <Button aria-label="Add context" size="sm" variant="outline">
            <Icon icon={AtSign} size={16} />
            Add Context
          </Button>
        </InputGroup.Prefix>
        <InputGroup.TextArea class="w-full resize-none px-3.5 py-0" placeholder="Assign tasks or ask anything..." rows={5} />
        <InputGroup.Suffix class="flex w-full items-center gap-1.5 px-3 py-0">
          <Tooltip delay={0}>
            <Button isIconOnly aria-label="Attach file" size="sm" variant="tertiary">
              <Icon icon={Plus} size={16} />
            </Button>
            <Tooltip.Content>
              <p class="text-xs">Add a files and more</p>
            </Tooltip.Content>
          </Tooltip>
          <Tooltip delay={0}>
            <Button isIconOnly aria-label="Connect Apps" size="sm" variant="tertiary">
              <Icon icon={Plug} size={16} />
            </Button>
            <Tooltip.Content>
              <p class="text-xs">Connect apps</p>
            </Tooltip.Content>
          </Tooltip>
          <div class="ms-auto flex items-center gap-1.5">
            <Tooltip delay={0}>
              <Button isIconOnly aria-label="Voice input" size="sm" variant="ghost">
                <Icon icon={Mic} size={16} />
              </Button>
              <Tooltip.Content>
                <p class="text-xs">Voice input</p>
              </Tooltip.Content>
            </Tooltip>
            <Tooltip delay={0}>
              <Button isIconOnly aria-label="Send prompt" isDisabled={!value().trim()} isPending={isSubmitting} onPress={handleSubmit}>
                {({ isPending }) => (isPending() ? <Spinner color="current" size="sm" /> : <Icon icon={ArrowUp} size={16} />)}
              </Button>
              <Tooltip.Content class="flex items-center gap-1">
                <p class="text-xs">Send</p>
                <Kbd class="h-4 rounded-sm px-1">
                  <Kbd.Abbr keyValue="enter" />
                </Kbd>
              </Tooltip.Content>
            </Tooltip>
          </div>
        </InputGroup.Suffix>
      </InputGroup>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithTextArea />
    </div>
  );
}
