// Rivet-authored ActionBar demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import type { Selection } from "@rivetjs/cdk/collections/types";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { ActionBar } from "@rivetjs/ui/action-bar";
import { Button } from "@rivetjs/ui/button";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Table } from "@rivetjs/ui/table";
import { Copy, Share2, Tag } from "lucide";

export const head = { title: "ActionBar: Responsive Labels" };

// #region demo
const TASKS = [
  { id: 1, title: "Draft launch post", owner: "Mara" },
  { id: 2, title: "Review pricing page", owner: "Ilya" },
  { id: 3, title: "Record demo video", owner: "Noor" },
];

function RowCheckbox(props: { label: string }) {
  return (
    <Checkbox aria-label={props.label} slot="selection">
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}

export function ResponsiveLabels() {
  const selected = signal<Selection>(new Set());
  const count = () => {
    const keys = selected();
    return keys === "all" ? TASKS.length : keys.size;
  };
  return (
    <div>
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Tasks" class="min-w-[360px]" selectionMode="multiple" selectedKeys={selected}>
            <Table.Header>
              <Table.Column class="pe-0">
                <RowCheckbox label="Select all" />
              </Table.Column>
              <Table.Column isRowHeader>Task</Table.Column>
              <Table.Column>Owner</Table.Column>
            </Table.Header>
            <Table.Body>
              {TASKS.map((task) => (
                <Table.Row id={task.id}>
                  <Table.Cell class="pe-0">
                    <RowCheckbox label={`Select ${task.title}`} />
                  </Table.Cell>
                  <Table.Cell>{task.title}</Table.Cell>
                  <Table.Cell>{task.owner}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <ActionBar isOpen={() => count() > 0}>
        <ActionBar.Prefix>{count()} selected</ActionBar.Prefix>
        <ActionBar.Content>
          <Button variant="ghost" size="sm">
            <Icon icon={Tag} size={16} />
            <span class="action-bar__label">Label</span>
          </Button>
          <Button variant="ghost" size="sm">
            <Icon icon={Copy} size={16} />
            <span class="action-bar__label">Duplicate</span>
          </Button>
          <Button variant="ghost" size="sm">
            <Icon icon={Share2} size={16} />
            <span class="action-bar__label">Share</span>
          </Button>
        </ActionBar.Content>
      </ActionBar>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ResponsiveLabels />
    </div>
  );
}
