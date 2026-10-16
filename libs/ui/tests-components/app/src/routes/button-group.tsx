// ButtonGroup / AvatarGroup structural selectors when a cdk overlay (Dropdown / Tooltip) leaves its `span[data-rv-overlay-anchor]` after the trigger:
// the first / last `.button` still get the rounded edges (HeroUI `:first-child` / `:last-child` assume nothing else in the group).
import { Icon } from "@rivetjs/kit/icon";
import { ChevronDown } from "lucide";
import { Avatar } from "@rivetjs/ui/avatar";
import { AvatarGroup } from "@rivetjs/ui/avatar-group";
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Tooltip } from "@rivetjs/ui/tooltip";

export default function ButtonGroupStories() {
  return (
    <main>
      <ButtonGroup id="bg-dropdown">
        <Button id="bg-merge">Merge pull request</Button>
        <Dropdown>
          <Button id="bg-more" isIconOnly aria-label="More options">
            <ButtonGroup.Separator />
            <Icon icon={ChevronDown} size={16} />
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu>
              <Dropdown.Item id="merge">Create a merge commit</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </ButtonGroup>
      <ButtonGroup id="bg-tooltip" variant="outline">
        <Tooltip>
          <Button id="bg-first">First</Button>
          <Tooltip.Content>First tip</Tooltip.Content>
        </Tooltip>
        <Button id="bg-middle">Middle</Button>
        <Button id="bg-last">Last</Button>
      </ButtonGroup>
      <AvatarGroup id="ag-tooltip" overlap="clip">
        <Tooltip>
          <Avatar id="ag-a">
            <Avatar.Fallback>AB</Avatar.Fallback>
          </Avatar>
          <Tooltip.Content>Ada</Tooltip.Content>
        </Tooltip>
        <Tooltip>
          <Avatar id="ag-b">
            <Avatar.Fallback>CD</Avatar.Fallback>
          </Avatar>
          <Tooltip.Content>Cy</Tooltip.Content>
        </Tooltip>
        <Tooltip>
          <Avatar id="ag-c">
            <Avatar.Fallback>EF</Avatar.Fallback>
          </Avatar>
          <Tooltip.Content>Eve</Tooltip.Content>
        </Tooltip>
      </AvatarGroup>
    </main>
  );
}
