import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/cdk/button";
import { Label } from "@rivetjs/cdk/label";
import { Tag, TagGroup, TagList } from "@rivetjs/cdk/tag-group";
import { createListData } from "@rivetjs/cdk/data";

export const head = { title: "TagGroup" };

export default function TagGroupStory() {
  const show = signal(false);
  const list = createListData({
    initialItems: [
      { id: "news", name: "News" },
      { id: "travel", name: "Travel" },
      { id: "gaming", name: "Gaming" },
    ],
  });
  const fnList = createListData({
    initialItems: [
      { id: "open", name: "Open" },
      { id: "bug", name: "Bug" },
      { id: "docs", name: "Docs" },
    ],
  });
  return (
    <section>
      <h1>TagGroup</h1>
      {/* Port of RAC TagGroup.ssr.test.js: server rows, then a conditional tag inserted in place after resume. */}
      <button id="tg-ssr-show" onClick={() => show.set(true)}>
        Show
      </button>
      <TagGroup id="tg-ssr" aria-label="TagGroup">
        <Label>Test</Label>
        <TagList>
          <Tag id="1">Left</Tag>
          <Tag id="2">Middle</Tag>
          <Show when={show}>
            <Tag id="4">Extra</Tag>
          </Show>
          <Tag id="3">Right</Tag>
        </TagList>
      </TagGroup>
      <TagGroup id="tg-remove" selectionMode="multiple" onRemove={(keys) => list.remove(...keys)}>
        <Label>Categories</Label>
        <TagList items={list.items}>
          {(item: { id: string; name: string }) => (
            <Tag textValue={item.name}>
              {item.name}
              <Button slot="remove">Remove</Button>
            </Tag>
          )}
        </TagList>
      </TagGroup>
      {/* Render-function Tag children (render props) with a remove button. */}
      <TagGroup id="tg-fn" selectionMode="multiple" defaultSelectedKeys={["bug"]} onRemove={(keys) => fnList.remove(...keys)}>
        <Label>Filters</Label>
        <TagList items={fnList.items}>
          {(item: { id: string; name: string }) => (
            <Tag textValue={item.name}>
              {({ isSelected }: { isSelected: () => boolean }) => (
                <>
                  {isSelected() ? <span class="mark" /> : null}
                  {item.name}
                  <Button slot="remove">Remove</Button>
                </>
              )}
            </Tag>
          )}
        </TagList>
      </TagGroup>
    </section>
  );
}
