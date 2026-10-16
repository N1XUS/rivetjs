// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button-group/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { ChevronDown } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";
import { Description } from "@rivetjs/ui/description";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "ButtonGroup: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <ButtonGroup>
      <Button class="rounded-none bg-[#08872B] data-hovered:bg-[#0FBF3E]">Merge pull request</Button>
      <Dropdown>
        <Button isIconOnly aria-label="Merge options" class="rounded-none bg-[#08872B] data-hovered:bg-[#0FBF3E]">
          <ButtonGroup.Separator />
          <Icon icon={ChevronDown} size={16} class="size-4" />
        </Button>
        <Dropdown.Popover class="max-w-[290px] rounded-none" placement="bottom end">
          <Dropdown.Menu>
            <Dropdown.Item class="flex flex-col items-start gap-1 rounded-none" id="merge" textValue="Create a merge commit">
              <Label>Create a merge commit</Label>
              <Description>All commits from this branch will be added to the base branch</Description>
            </Dropdown.Item>
            <Dropdown.Item class="flex flex-col items-start gap-1 rounded-none" id="squash-and-merge" textValue="Squash and merge">
              <Label>Squash and merge</Label>
              <Description>The 14 commits from this branch will be combined into one commit in the base branch</Description>
            </Dropdown.Item>
            <Dropdown.Item class="flex flex-col items-start gap-1 rounded-none" id="rebase-and-merge" textValue="Rebase and merge">
              <Label>Rebase and merge</Label>
              <Description>The 14 commits from this branch will be rebased and added to the base branch</Description>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </ButtonGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
