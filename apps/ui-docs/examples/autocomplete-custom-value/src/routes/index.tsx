// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/custom-value.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { selectedKeys as keysOf } from "@rivetjs/cdk/select";
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { Description } from "@rivetjs/ui/description";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "Autocomplete: Custom Value" };

// #region demo
const { contains } = createFilter({ sensitivity: "base" });

export function CustomValue() {
  const currencies = [
    { code: "USD", id: "usd", name: "US Dollar", symbol: "$" },
    { code: "EUR", id: "eur", name: "Euro", symbol: "€" },
    { code: "GBP", id: "gbp", name: "British Pound", symbol: "£" },
    { code: "JPY", id: "jpy", name: "Japanese Yen", symbol: "¥" },
    { code: "CHF", id: "chf", name: "Swiss Franc", symbol: "₣" },
  ];

  return (
    <Autocomplete class="w-[256px]" defaultValue="usd" placeholder="Select a currency" selectionMode="single">
      <Label>Currency</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value>
          {({ defaultChildren, isPlaceholder, state }) => {
            const selectedCurrency = currencies.find((currency) => currency.id === keysOf(state)[0]);

            if (isPlaceholder() || !selectedCurrency) {
              return defaultChildren;
            }

            return (
              <span class="flex min-w-0 items-center gap-1.5">
                <span class="font-medium">{selectedCurrency.symbol}</span>
                <span>{selectedCurrency.code}</span>
                <span class="truncate text-muted">{selectedCurrency.name}</span>
              </span>
            );
          }}
        </Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={(text, input) => contains(text, input)}>
          <SearchField autoFocus aria-label="Search currencies" name="search" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search currencies..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
            {currencies.map((currency) => (
              <ListBox.Item id={currency.id} textValue={`${currency.code} ${currency.name}`}>
                <div class="flex flex-col">
                  <Label>{currency.code}</Label>
                  <Description>{currency.name}</Description>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomValue />
    </div>
  );
}
