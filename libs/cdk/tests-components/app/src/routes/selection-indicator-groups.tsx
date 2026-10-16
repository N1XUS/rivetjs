import { signal } from "@rivetjs/reactivity";
import { RadioGroup } from "@rivetjs/cdk/radio-group";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";
import { SelectionIndicator } from "@rivetjs/cdk/selection-indicator";
import { SharedElementTransition } from "@rivetjs/cdk/shared-element-transition";
import { Tag, TagGroup, TagList } from "@rivetjs/cdk/tag-group";
import { GridList, GridListItem } from "@rivetjs/cdk/grid-list";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";

export const head = { title: "SelectionIndicator groups" };

const sizes = [
  { value: "s", label: "Small" },
  { value: "m", label: "Medium" },
  { value: "l", label: "Large" },
];

export default function SelectionIndicatorGroupsStory() {
  const bold = signal(false);
  const italic = signal(false);
  return (
    <section class="ind">
      <h1>SelectionIndicator groups</h1>
      <RadioGroup id="ind-radio" label="Size" items={sizes} defaultValue="m" orientation="horizontal">
        {(item) => (
          <>
            {item().label}
            <SelectionIndicator />
          </>
        )}
      </RadioGroup>
      <SharedElementTransition>
        <ToggleButton id="ind-bold" isSelected={bold}>
          Bold
          <SelectionIndicator />
        </ToggleButton>
        <ToggleButton id="ind-italic" isSelected={italic}>
          Italic
          <SelectionIndicator />
        </ToggleButton>
      </SharedElementTransition>
      {/* RAC: TagList / GridList / Table provide the SharedElementTransition scope themselves. */}
      <TagGroup id="ind-tags" aria-label="Tags" selectionMode="single" defaultSelectedKeys={["b"]}>
        <TagList>
          <Tag id="a">
            Alpha
            <SelectionIndicator />
          </Tag>
          <Tag id="b">
            Beta
            <SelectionIndicator />
          </Tag>
        </TagList>
      </TagGroup>
      <GridList id="ind-grid" aria-label="Grid" selectionMode="single" defaultSelectedKeys={["b"]}>
        <GridListItem id="a" textValue="Alpha">
          Alpha
          <SelectionIndicator />
        </GridListItem>
        <GridListItem id="b" textValue="Beta">
          Beta
          <SelectionIndicator />
        </GridListItem>
      </GridList>
      <Table id="ind-table" aria-label="Table" selectionMode="single" defaultSelectedKeys={["b"]}>
        <TableHeader>
          <Column id="name" isRowHeader>
            Name
          </Column>
        </TableHeader>
        <TableBody>
          <Row id="a">
            <Cell>
              Alpha
              <SelectionIndicator />
            </Cell>
          </Row>
          <Row id="b">
            <Cell>
              Beta
              <SelectionIndicator />
            </Cell>
          </Row>
        </TableBody>
      </Table>
    </section>
  );
}
