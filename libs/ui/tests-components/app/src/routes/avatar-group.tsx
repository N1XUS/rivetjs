// AvatarGroup on a resumed page: `#ag` with a live `max` (`#ag-more` / `#ag-less` step it 1 → 4 → 1), automatic `+N` count; `#ag-sized`
// static group (size / color / variant inherited by every Avatar, max 2 → `+1`); `#ag-count` explicit Count.
import { signal } from "@rivetjs/reactivity";
import { Avatar } from "@rivetjs/ui/avatar";
import { AvatarGroup } from "@rivetjs/ui/avatar-group";

export default function AvatarGroupStories() {
  const max = signal(2);
  return (
    <main>
      <AvatarGroup id="ag" max={max()}>
        <Avatar id="ag-a">
          <Avatar.Fallback>A</Avatar.Fallback>
        </Avatar>
        <Avatar id="ag-b">
          <Avatar.Fallback>B</Avatar.Fallback>
        </Avatar>
        <Avatar id="ag-c">
          <Avatar.Fallback>C</Avatar.Fallback>
        </Avatar>
        <Avatar id="ag-d">
          <Avatar.Fallback>D</Avatar.Fallback>
        </Avatar>
      </AvatarGroup>
      <button id="ag-more" type="button" onClick={() => max.set(Math.min(4, max() + 1))}>
        more
      </button>
      <button id="ag-less" type="button" onClick={() => max.set(Math.max(1, max() - 1))}>
        less
      </button>
      <output id="ag-max">{max()}</output>

      <AvatarGroup id="ag-sized" size="lg" color="accent" variant="soft" max={2}>
        <Avatar>
          <Avatar.Fallback>X</Avatar.Fallback>
        </Avatar>
        <Avatar>
          <Avatar.Fallback>Y</Avatar.Fallback>
        </Avatar>
        <Avatar>
          <Avatar.Fallback>Z</Avatar.Fallback>
        </Avatar>
      </AvatarGroup>

      <AvatarGroup id="ag-count">
        <Avatar>
          <Avatar.Fallback>P</Avatar.Fallback>
        </Avatar>
        <AvatarGroup.Count>+9</AvatarGroup.Count>
      </AvatarGroup>
    </main>
  );
}
