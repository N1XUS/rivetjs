// Type-level tests, checked by `tsc -p libs/ui`: AvatarGroup (generic root) + Count props.
import { Avatar } from "../src/components/avatar/index.ts";
import { AvatarGroup, AvatarGroupRoot } from "../src/components/avatar-group/index.ts";
import type { AvatarGroup as AvatarGroupTypes } from "../src/components/avatar-group/index.ts";

export const Groups = () => (
  <>
    <AvatarGroup max={3} size="sm" color="accent" variant="soft" overlap="ring" isGrid class="x" id="g">
      <Avatar>
        <Avatar.Fallback>A</Avatar.Fallback>
      </Avatar>
      <AvatarGroup.Count size="lg" color="danger">
        +9
      </AvatarGroup.Count>
    </AvatarGroup>
    <AvatarGroupRoot<"section"> render={(props) => <section {...(props as {})} />}>x</AvatarGroupRoot>
  </>
);

export const rootProps: AvatarGroupTypes["Props"] = { max: 2, overlap: "clip" };

// @ts-expect-error bad overlap
export const BadOverlap = () => <AvatarGroup overlap="stack">x</AvatarGroup>;
// @ts-expect-error max is a number
export const BadMax = () => <AvatarGroup max="2">x</AvatarGroup>;
