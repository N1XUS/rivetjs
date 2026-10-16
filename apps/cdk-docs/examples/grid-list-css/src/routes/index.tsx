import { GridList, GridListHeader, GridListItem, GridListSection } from "@rivetjs/cdk/grid-list";
import { Text } from "@rivetjs/cdk/text";

export const head = { title: "GridList with plain CSS" };

// #region demo
export default function Plans() {
  return (
    <GridList id="plans" aria-label="Plans" selectionMode="single" defaultSelectedKeys={["free"]} disabledKeys={["team"]}>
      <GridListSection id="plans-section">
        <GridListHeader>Plans</GridListHeader>
        <GridListItem id="free" textValue="Free">
          <Text>Free</Text>
          <Text slot="description">1 project</Text>
        </GridListItem>
        <GridListItem id="pro" textValue="Pro">
          <Text>Pro</Text>
          <Text slot="description">Unlimited projects</Text>
        </GridListItem>
        <GridListItem id="team" textValue="Team">
          <Text>Team</Text>
          <Text slot="description">Contact sales</Text>
        </GridListItem>
      </GridListSection>
    </GridList>
  );
}
// #endregion
