export const head = { title: "Products" };

// #region demo
// URL: "/". Layouts: _layout.tsx, then (shop)/_layout.tsx, then this page.
export default function Products() {
  return (
    <>
      <h1 id="page-title" class="text-xl font-semibold">
        Products
      </h1>
      <ul class="mt-2 list-disc pl-5">
        <li>Desk lamp</li>
        <li>Notebook</li>
      </ul>
    </>
  );
}
// #endregion
