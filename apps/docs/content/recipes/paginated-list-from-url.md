---
title: Paginated list from the URL
description: Keep the page number in the URL (?page=2), read it in a loader, return one page of rows and link between pages with plain anchors.
template: recipe
related: [guides/routing/loading-data, guides/routing/links-and-navigation, guides/routing/head-and-seo, best-practices/links-and-forms-without-js]
---

## What you will build

A list of 47 books, 10 per page. The current page is in the URL: `/?page=2`. Links move between pages. Reload, share or bookmark the URL, and you get the same page.

This example needs a server, because the loader reads the URL of each request. It is shown as code; copy it into the server starter to run it.

::example{id=paginated-list-from-url}

## How it works

### 1. The URL is the state

There is no signal for the page number. The page number lives in the query string. That gives you a lot for free:

- The back and forward buttons work.
- A shared link opens the same page.
- Search engines can follow the links.

### 2. The loader reads `?page=`

`serverLoad` in `index.tsx` runs on the server for every request. It receives the request URL as `url`:

```tsx title="src/routes/index.tsx"
export const serverLoad = ({ url }: RequestEvent) => {
  const page = Number(url.searchParams.get("page") ?? "1");
  // …check the number, then:
  return { items: books.slice(start, start + PER_PAGE), page, pages, total: books.length };
};
```

It returns **only the rows of this page**. The browser never receives the other 37 books. With a real database you would use `LIMIT` and `OFFSET` (or a cursor) here.

### 3. Bad page numbers redirect

`?page=abc`, `?page=0` or `?page=99` do not exist. The loader throws `redirect(...)` to the nearest real page. You could also throw `notFound()` to show your 404 page. Pick one; do not render an empty list with status 200.

### 4. The page renders links, not buttons

```tsx
<a href={`?page=${page + 1}`} rel="next">Next</a>
```

These are ordinary `<a href>` links. They work before any JavaScript has loaded, and with JavaScript turned off.

When the Rivet router is running, it handles a click on such a link in the page. It fetches only the new page's data from the server (the same loader runs), renders the new list and updates the address bar. There is no full page reload. When the pointer rests on a link, the router already starts fetching that page's data.

The current page link gets `aria-current="page"`, so screen readers announce it.

### 5. The title includes the page number

`head` can be a function of the loader data:

```tsx
export const head = ({ data }: { data: Data }) => ({ title: `Books, page ${data.page} of ${data.pages}` });
```

Each page then has its own title in the browser history.

## Variations

- **Pages in the path.** Use a file `src/routes/books/[page].tsx` for `/books/2` instead of a query string. Read `params.page` in the loader. In a static build, export `serverEntries()` to list the pages to render ahead of time.
- **Filters and sorting.** Add more query parameters (`?page=2&sort=title`). Keep them when you build links: start from the current `url.searchParams`, change `page`, and use `"?" + params.toString()`.
- **"Load more".** Keep the links for no-JavaScript visitors, and add a button whose handler fetches the next page and appends it to a signal.

## Watch out

- **Static builds cannot read the query string.** A prerendered page is one HTML file, whatever the query. For a static site, put the page number in the path and use `serverEntries()`.
- **Validate every parameter.** The URL is user input. Check that numbers are whole numbers and in range before you use them in a database query.
- **Keep page size on the server.** Do not let `?per_page=100000` decide how much data you load.
