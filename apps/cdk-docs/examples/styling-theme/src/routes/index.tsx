import { ToggleButton } from "@rivetjs/cdk/toggle-button";
import { ListBox } from "@rivetjs/cdk/listbox";
import { Tabs } from "@rivetjs/cdk/tabs";

export const head = { title: "theme.css with your tokens" };

const views = [
  { id: "list", label: "List" },
  { id: "board", label: "Board" },
  { id: "calendar", label: "Calendar" },
];

// #region demo
export default function Board() {
  return (
    <section class="demo">
      <ToggleButton id="pin">Pin</ToggleButton>
      <ListBox id="view" aria-label="View" items={views} selectionMode="single" defaultSelectedKeys={["board"]} />
      <Tabs id="tabs" aria-label="Project" items={views} panel={(item) => <p>{item.label} view</p>} />
    </section>
  );
}
// #endregion
