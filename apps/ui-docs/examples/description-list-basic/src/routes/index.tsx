// Rivet-authored DescriptionList demo (Rivet addition, own demo content).
import { DescriptionList } from "@rivetjs/ui/description-list";
import { Separator } from "@rivetjs/ui/separator";
import { Surface } from "@rivetjs/ui/surface";

export const head = { title: "DescriptionList: Usage" };

// #region demo
const LINES = [
  { name: "2 × Kiln stoneware mug", price: "$48" },
  { name: "1 × Tidewater linen shirt", price: "$68" },
  { name: "1 × Harbor canvas tote", price: "$42" },
];

export function OrderSummary() {
  return (
    <Surface id="order-summary" variant="secondary" class="flex w-full max-w-xs flex-col gap-3 rounded-2xl p-4">
      <DescriptionList aria-label="Items">
        {LINES.map((line) => (
          <DescriptionList.Item>
            <DescriptionList.Term>{line.name}</DescriptionList.Term>
            <DescriptionList.Details>{line.price}</DescriptionList.Details>
          </DescriptionList.Item>
        ))}
      </DescriptionList>
      <Separator />
      <DescriptionList aria-label="Totals">
        <DescriptionList.Item>
          <DescriptionList.Term>Shipping</DescriptionList.Term>
          <DescriptionList.Details>Free</DescriptionList.Details>
        </DescriptionList.Item>
        <DescriptionList.Item isEmphasized>
          <DescriptionList.Term>Total</DescriptionList.Term>
          <DescriptionList.Details>$158</DescriptionList.Details>
        </DescriptionList.Item>
      </DescriptionList>
    </Surface>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <OrderSummary />
    </div>
  );
}
