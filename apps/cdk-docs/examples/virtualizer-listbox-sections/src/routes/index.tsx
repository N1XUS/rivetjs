import { signal } from "@rivetjs/reactivity";
import { Collection } from "@rivetjs/cdk/collections/components";
import { Header } from "@rivetjs/cdk/header";
import { ListBox, ListBoxItem, ListBoxSection, type Selection } from "@rivetjs/cdk/listbox";
import { ListLayout, CollectionVirtualizer } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: ListBox sections" };

interface Member {
  id: string;
  name: string;
}
interface Team {
  id: string;
  name: string;
  members: Member[];
}

const teams: Team[] = Array.from({ length: 20 }, (_, t) => ({
  id: `t${t + 1}`,
  name: `Team ${t + 1}`,
  members: Array.from({ length: 50 }, (_, i) => ({ id: `t${t + 1}-${i + 1}`, name: `Member ${t + 1}.${i + 1}` })),
}));

// #region demo
export default function Teams() {
  const selected = signal<Selection>(new Set());
  const text = () => {
    const keys = selected();
    return keys === "all" ? "all" : [...keys].join(", ") || "none";
  };
  return (
    <section class="stack">
      {/* headingHeight / rowHeight: the layout's sizes for headers and options (match the CSS). */}
      <CollectionVirtualizer layout={ListLayout} layoutOptions={{ rowHeight: 32, headingHeight: 28 }} initialSize={{ width: 278, height: 278 }}>
        <ListBox id="teams" aria-label="Teams" items={teams} selectionMode="multiple" selectedKeys={selected} onSelectionChange={(keys) => selected.set(keys)}>
          {(team: Team) => (
            <ListBoxSection id={team.id}>
              <Header>{team.name}</Header>
              <Collection items={team.members}>
                {(member: Member) => (
                  <ListBoxItem id={member.id} textValue={member.name}>
                    {member.name}
                  </ListBoxItem>
                )}
              </Collection>
            </ListBoxSection>
          )}
        </ListBox>
      </CollectionVirtualizer>
      <output id="teams-value">Selected: {text()}</output>
    </section>
  );
}
// #endregion
