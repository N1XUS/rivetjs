// TABLE-NATIVE — visual parity (`/table-static-parity`): each static table (`#tp-native-<variant>`: proven, native markup)
// next to its twin on the grid path (`#tp-grid-<variant>`: `selectionMode="none"` is not a native prop, so the build keeps
// the cdk Table). Same rows, same classes: the cells must measure and paint the same. One table per component: the build's
// proof is per caller (a grid table in the same component keeps its static siblings on the grid path too). Explicit
// `Table.Content` ids: a grid table's generated id differs between a resumed page and a browser render (resume fuzz).
import { Table } from "@rivetjs/ui/table";

function NativePrimary() {
  return (
    <Table id="tp-native-primary">
      <Table.ScrollContainer>
        <Table.Content id="tp-native-primary-table" aria-label="Native primary">
          <Table.Header>
            <Table.Column isRowHeader>Name</Table.Column>
            <Table.Column>Role</Table.Column>
            <Table.Column>Status</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Row>
              <Table.Cell>Kate Moore</Table.Cell>
              <Table.Cell>CEO</Table.Cell>
              <Table.Cell>Active</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>John Smith</Table.Cell>
              <Table.Cell>CTO</Table.Cell>
              <Table.Cell>On leave</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function GridPrimary() {
  return (
    <Table id="tp-grid-primary">
      <Table.ScrollContainer>
        <Table.Content id="tp-grid-primary-table" aria-label="Grid primary" selectionMode="none">
          <Table.Header>
            <Table.Column isRowHeader>Name</Table.Column>
            <Table.Column>Role</Table.Column>
            <Table.Column>Status</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Row>
              <Table.Cell>Kate Moore</Table.Cell>
              <Table.Cell>CEO</Table.Cell>
              <Table.Cell>Active</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>John Smith</Table.Cell>
              <Table.Cell>CTO</Table.Cell>
              <Table.Cell>On leave</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function NativeSecondary() {
  return (
    <Table id="tp-native-secondary" variant="secondary">
      <Table.ScrollContainer>
        <Table.Content id="tp-native-secondary-table" aria-label="Native secondary">
          <Table.Header>
            <Table.Column isRowHeader>Name</Table.Column>
            <Table.Column>Role</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Row>
              <Table.Cell>Kate Moore</Table.Cell>
              <Table.Cell>CEO</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>John Smith</Table.Cell>
              <Table.Cell>CTO</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function GridSecondary() {
  return (
    <Table id="tp-grid-secondary" variant="secondary">
      <Table.ScrollContainer>
        <Table.Content id="tp-grid-secondary-table" aria-label="Grid secondary" selectionMode="none">
          <Table.Header>
            <Table.Column isRowHeader>Name</Table.Column>
            <Table.Column>Role</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Row>
              <Table.Cell>Kate Moore</Table.Cell>
              <Table.Cell>CEO</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>John Smith</Table.Cell>
              <Table.Cell>CTO</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

export default function TableStaticParity() {
  return (
    <main class="flex w-[640px] flex-col gap-6 p-6">
      <NativePrimary />
      <GridPrimary />
      <NativeSecondary />
      <GridSecondary />
    </main>
  );
}
