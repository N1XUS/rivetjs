import { signal } from "@rivetjs/reactivity";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";
import type { Selection } from "@rivetjs/cdk/types";
import { TableLayout, CollectionVirtualizer } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: Table" };

interface Member {
  id: number;
  name: string;
  team: string;
}

const teams = ["Platform", "Design", "Growth", "Support"];
const staff: Member[] = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, name: `Member ${i + 1}`, team: teams[i % teams.length]! }));

// #region demo
export default function Staff() {
  const selected = signal<Selection>(new Set());
  const text = () => {
    const keys = selected();
    return keys === "all" ? "all" : [...keys].join(", ") || "none";
  };
  return (
    <section class="stack">
      <CollectionVirtualizer layout={TableLayout} layoutOptions={{ rowHeight: 32, headingHeight: 32 }} initialSize={{ width: 358, height: 278 }}>
        <Table id="staff" aria-label="Staff" selectionMode="multiple" selectedKeys={selected} onSelectionChange={(keys) => selected.set(keys)}>
          <TableHeader>
            <Column id="name" isRowHeader>
              Name
            </Column>
            <Column id="team">Team</Column>
          </TableHeader>
          <TableBody items={staff}>
            {(member: Member) => (
              <Row id={member.id}>
                <Cell>{member.name}</Cell>
                <Cell>{member.team}</Cell>
              </Row>
            )}
          </TableBody>
        </Table>
      </CollectionVirtualizer>
      <output id="staff-value">Selected: {text()}</output>
    </section>
  );
}
// #endregion
