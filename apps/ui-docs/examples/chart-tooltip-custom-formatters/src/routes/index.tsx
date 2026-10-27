// Rivet-authored ChartTooltip demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { ChartTooltip } from "@rivetjs/ui/chart-tooltip";

export const head = { title: "ChartTooltip: Custom Formatters" };

// #region demo
export function CustomFormatters() {
  const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return (
    <ChartTooltip.Content
      id="ct-format"
      label="2026-03-01"
      payload={[
        { name: "Revenue", value: 12400, color: "var(--chart-1)" },
        { name: "Expenses", value: 8150, color: "var(--chart-2)" },
      ]}
      labelFormatter={(label) => new Date(String(label)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
      valueFormatter={(value) => currency.format(Number(value))}
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <CustomFormatters />
    </div>
  );
}
