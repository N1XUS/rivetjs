// Rivet-authored Widget demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Widget } from "@rivetjs/ui/widget";
import { Table } from "@rivetjs/ui/table";

export const head = { title: "Widget: With Table" };

// #region demo
const INVOICES = [
  { id: "INV-1042", customer: "Northwind", amount: "$1,240.00", status: "Paid" },
  { id: "INV-1043", customer: "Contoso", amount: "$860.00", status: "Pending" },
  { id: "INV-1044", customer: "Fabrikam", amount: "$3,105.50", status: "Paid" },
];

export function WithTable() {
  return (
    <Widget id="widget-table" class="w-full max-w-2xl">
      <Widget.Header>
        <Widget.Title>Recent invoices</Widget.Title>
      </Widget.Header>
      <Widget.Content class="p-0">
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Recent invoices" class="min-w-[480px]">
              <Table.Header>
                <Table.Column isRowHeader>Invoice</Table.Column>
                <Table.Column>Customer</Table.Column>
                <Table.Column>Amount</Table.Column>
                <Table.Column>Status</Table.Column>
              </Table.Header>
              <Table.Body>
                {INVOICES.map((row) => (
                  <Table.Row id={row.id}>
                    <Table.Cell>{row.id}</Table.Cell>
                    <Table.Cell>{row.customer}</Table.Cell>
                    <Table.Cell>{row.amount}</Table.Cell>
                    <Table.Cell>{row.status}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </Widget.Content>
    </Widget>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithTable />
    </div>
  );
}
