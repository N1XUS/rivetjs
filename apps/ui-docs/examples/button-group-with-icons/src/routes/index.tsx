// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button-group/with-icons.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Globe, Plus, Trash2 } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";

export const head = { title: "ButtonGroup: With Icons" };

// #region demo
export function WithIcons() {
  return (
    <div class="flex flex-col gap-6">
      <div class="flex flex-col items-start gap-2">
        <p class="text-sm text-muted">With icons</p>
        <ButtonGroup variant="secondary">
          <Button>
            <Icon icon={Globe} size={16} />
            Search
          </Button>
          <Button>
            <ButtonGroup.Separator />
            <Icon icon={Plus} size={16} />
            Add
          </Button>
          <Button>
            <ButtonGroup.Separator />
            <Icon icon={Trash2} size={16} />
            Delete
          </Button>
        </ButtonGroup>
      </div>
      <div class="flex flex-col items-start gap-2">
        <p class="text-sm text-muted">Icon only buttons</p>
        <ButtonGroup variant="tertiary">
          <Button isIconOnly aria-label="Search">
            <Icon icon={Globe} size={16} />
          </Button>
          <Button isIconOnly aria-label="Add">
            <ButtonGroup.Separator />
            <Icon icon={Plus} size={16} />
          </Button>
          <Button isIconOnly aria-label="Delete">
            <ButtonGroup.Separator />
            <Icon icon={Trash2} size={16} />
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithIcons />
    </div>
  );
}
