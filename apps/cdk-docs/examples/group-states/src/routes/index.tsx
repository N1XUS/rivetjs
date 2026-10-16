import { Group } from "@rivetjs/cdk/group";

export const head = { title: "Group state and role" };

// #region demo
export default function States() {
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      {/* State props only style the group: disable the controls inside yourself. */}
      <Group id="g-off" aria-label="Disabled (data only)" isDisabled>
        <input aria-label="A" disabled />
      </Group>
      <Group id="g-aria-off" aria-label="Disabled (announced)" aria-disabled>
        <input aria-label="B" disabled />
      </Group>
      <Group id="g-bad" aria-label="Invalid" aria-invalid>
        <input aria-label="C" />
      </Group>
      <Group id="g-ro" aria-label="Read-only" isReadOnly>
        <input aria-label="D" readOnly value="fixed" />
      </Group>
      <span id="filters-title">Filters</span>
      <Group id="g-region" role="region" aria-labelledby="filters-title">
        <input aria-label="Filter" />
      </Group>
      <Group id="g-plain" role="presentation">
        <span>Layout only</span>
      </Group>
    </section>
  );
}
// #endregion
