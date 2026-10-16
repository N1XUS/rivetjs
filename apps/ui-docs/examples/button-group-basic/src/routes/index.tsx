// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button-group/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GitFork,
  Ellipsis,
  Image as ImageIcon,
  Pin,
  QrCode,
  Star,
  TextAlignCenter,
  TextAlignJustify,
  TextAlignStart,
  TextAlignEnd,
  ThumbsDown,
  ThumbsUp,
  Video,
} from "lucide";
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";
import { Chip } from "@rivetjs/ui/chip";
import { Description } from "@rivetjs/ui/description";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "ButtonGroup: Usage" };

// #region demo
export function Basic() {
  return (
    <div class="flex flex-col items-start gap-6">
      {/* Single button with dropdown */}
      <div class="flex flex-col gap-2">
        <ButtonGroup>
          <Button>Merge pull request</Button>
          <Dropdown>
            <Button isIconOnly aria-label="More options">
              <ButtonGroup.Separator />
              <Icon icon={ChevronDown} size={16} />
            </Button>
            <Dropdown.Popover class="max-w-[290px]" placement="bottom end">
              <Dropdown.Menu>
                <Dropdown.Item class="flex flex-col items-start gap-1" id="merge" textValue="Create a merge commit">
                  <Label>Create a merge commit</Label>
                  <Description>All commits from this branch will be added to the base branch</Description>
                </Dropdown.Item>
                <Dropdown.Item class="flex flex-col items-start gap-1" id="squash-and-merge" textValue="Squash and merge">
                  <Label>Squash and merge</Label>
                  <Description>The 14 commits from this branch will be combined into one commit in the base branch</Description>
                </Dropdown.Item>
                <Dropdown.Item class="flex flex-col items-start gap-1" id="rebase-and-merge" textValue="Rebase and merge">
                  <Label>Rebase and merge</Label>
                  <Description>The 14 commits from this branch will be rebased and added to the base branch</Description>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </ButtonGroup>
      </div>

      {/* Individual buttons */}
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap gap-x-2 gap-y-4">
          <ButtonGroup variant="tertiary">
            <Button>
              <Icon icon={GitFork} size={16} class="size-3.5" />
              Fork
              <Chip color="accent" size="sm" variant="soft">
                24
              </Chip>
            </Button>
            <Button isIconOnly aria-label="More fork options">
              <ButtonGroup.Separator />
              <Icon icon={ChevronDown} size={16} />
            </Button>
          </ButtonGroup>
          <ButtonGroup variant="tertiary">
            <Button isIconOnly aria-label="Show QR code">
              <Icon icon={QrCode} size={16} />
            </Button>
            <Button>
              <ButtonGroup.Separator />
              Scan to pay
            </Button>
          </ButtonGroup>
          <ButtonGroup variant="tertiary">
            <Button>
              <Icon icon={ThumbsUp} size={16} />
              <span class="text-xs font-semibold">2.4K</span>
            </Button>
            <Button isIconOnly aria-label="Dislike">
              <ButtonGroup.Separator />
              <Icon icon={ThumbsDown} size={16} />
            </Button>
          </ButtonGroup>
          <ButtonGroup variant="tertiary">
            <Button>
              <Icon icon={Star} size={16} class="size-3.5" />
              Star
            </Button>
            <Button class="px-2">
              <ButtonGroup.Separator />
              <Chip color="accent" size="sm" variant="soft">
                104
              </Chip>
            </Button>
          </ButtonGroup>
          <ButtonGroup variant="tertiary">
            <Button>
              <Icon icon={Pin} size={16} />
              Pinned
            </Button>
            <Button isIconOnly aria-label="More pin options">
              <ButtonGroup.Separator />
              <Icon icon={ChevronDown} size={16} />
            </Button>
          </ButtonGroup>
        </div>
      </div>

      {/* Previous/Next Button Group */}
      <div class="flex flex-col gap-2">
        <ButtonGroup variant="tertiary">
          <Button>
            <Icon icon={ChevronLeft} size={16} />
            Previous
          </Button>
          <Button>
            <ButtonGroup.Separator />
            Next
            <Icon icon={ChevronRight} size={16} />
          </Button>
        </ButtonGroup>
      </div>

      {/* Content Selection Button Group */}
      <div class="flex flex-col gap-2">
        <ButtonGroup variant="tertiary">
          <Button>
            <Icon icon={ImageIcon} size={16} />
            Photos
          </Button>
          <Button>
            <ButtonGroup.Separator />
            <Icon icon={Video} size={16} />
            Videos
          </Button>
          <Button isIconOnly aria-label="More options">
            <ButtonGroup.Separator />
            <Icon icon={Ellipsis} size={16} />
          </Button>
        </ButtonGroup>
      </div>

      {/* Text Alignment Button Group */}
      <div class="flex flex-col gap-2">
        <ButtonGroup variant="tertiary">
          <Button>Left</Button>
          <Button>
            <ButtonGroup.Separator />
            Center
          </Button>
          <Button>
            <ButtonGroup.Separator />
            Right
          </Button>
        </ButtonGroup>
      </div>

      {/* Icon-Only Alignment Button Group */}
      <div class="flex flex-col gap-2">
        <ButtonGroup variant="tertiary">
          <Button isIconOnly aria-label="Align left">
            <Icon icon={TextAlignStart} size={16} />
          </Button>
          <Button isIconOnly aria-label="Align center">
            <ButtonGroup.Separator />
            <Icon icon={TextAlignCenter} size={16} />
          </Button>
          <Button isIconOnly aria-label="Align right">
            <ButtonGroup.Separator />
            <Icon icon={TextAlignEnd} size={16} />
          </Button>
          <Button isIconOnly aria-label="Justify">
            <ButtonGroup.Separator />
            <Icon icon={TextAlignJustify} size={16} />
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
      <Basic />
    </div>
  );
}
