import { Group } from "@rivetjs/cdk/group";

export const head = { title: "Group focus state" };

// #region demo
export default function SearchBox() {
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <button type="button" id="g-before">
        Before
      </button>
      <Group id="search" aria-label="Search">
        <input id="g-query" aria-label="Query" placeholder="Search…" />
        <button type="button">Go</button>
      </Group>
    </section>
  );
}
// #endregion
