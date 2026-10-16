// Rivet-authored Pagination demo (Rivet addition, own content): the summary range is an InlineSelect that picks the page size.
import { useLocale } from "@rivetjs/cdk/i18n";
import { signal } from "@rivetjs/reactivity";
import type { Key } from "@rivetjs/cdk/select";
import { InlineSelect } from "@rivetjs/ui/inline-select";
import { ListBox } from "@rivetjs/ui/list-box";
import { Pagination } from "@rivetjs/ui/pagination";

export const head = { title: "Pagination: Page Size Select" };

// #region demo
const PAGE_SIZES = [10, 20, 50, 100];

export function PaginationPageSize() {
  const { locale } = useLocale();
  const totalItems = 120;
  const page = signal(1);
  const pageSize = signal(10);

  const totalPages = () => Math.ceil(totalItems / pageSize());
  const startItem = () => (page() - 1) * pageSize() + 1;
  const endItem = () => Math.min(page() * pageSize(), totalItems);
  const format = (n: number) => n.toLocaleString(locale);
  const range = () => `${format(startItem())}–${format(endItem())}`;

  const getPageNumbers = () => {
    const last = totalPages();
    const pages: (number | "ellipsis")[] = [];
    if (last <= 7) {
      for (let i = 1; i <= last; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (page() > 3) pages.push("ellipsis");
    for (let i = Math.max(2, page() - 1); i <= Math.min(last - 1, page() + 1); i++) pages.push(i);
    if (page() < last - 2) pages.push("ellipsis");
    pages.push(last);
    return pages;
  };

  return (
    <Pagination class="w-full">
      <Pagination.Summary>
        Showing{" "}
        <InlineSelect
          defaultValue="10"
          aria-label="Items per page"
          onChange={(key: Key | null) => {
            // Keep the first visible item on the new page.
            const first = (page() - 1) * pageSize();
            const size = Number(key);
            pageSize.set(size);
            page.set(Math.floor(first / size) + 1);
          }}
        >
          <InlineSelect.Trigger>
            <InlineSelect.Value>{range()}</InlineSelect.Value>
            <InlineSelect.Indicator />
          </InlineSelect.Trigger>
          <InlineSelect.Popover placement="bottom start">
            <ListBox>
              {PAGE_SIZES.map((size) => (
                <ListBox.Item id={String(size)} textValue={`${size} per page`}>
                  {size} per page
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </InlineSelect.Popover>
        </InlineSelect>{" "}
        of {format(totalItems)} results
      </Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={page() === 1} onPress={() => page.update((p) => p - 1)}>
            <Pagination.PreviousIcon />
            <span>Previous</span>
          </Pagination.Previous>
        </Pagination.Item>
        {getPageNumbers().map((p) =>
          p === "ellipsis" ? (
            <Pagination.Item>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : (
            <Pagination.Item>
              <Pagination.Link isActive={p === page()} onPress={() => page.set(p)}>
                {p}
              </Pagination.Link>
            </Pagination.Item>
          ),
        )}
        <Pagination.Item>
          <Pagination.Next isDisabled={page() === totalPages()} onPress={() => page.update((p) => p + 1)}>
            <span>Next</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <PaginationPageSize />
    </div>
  );
}
