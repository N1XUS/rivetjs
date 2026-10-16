// Server-target suite: `Pagination` SSR — nav landmark + BEM classes, items, active link attributes, nav buttons, ellipsis, summary.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Pagination } from "../index.ts";
import { assertSameHtml } from "./same-html.ts";

test("pagination SSR: markup + classes", async () => {
  const html = await renderToString(() => (
    <Pagination size="sm">
      <Pagination.Summary>1 to 5 of 10</Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled>
            <Pagination.PreviousIcon />
            <span>Previous</span>
          </Pagination.Previous>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link isActive>1</Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Ellipsis />
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Next>
            <span>Next</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  ));
  assert.match(html, /<nav[^>]*class="pagination pagination--sm"/);
  assert.match(html, /<nav[^>]*role="navigation"/);
  assert.match(html, /<nav[^>]*aria-label="pagination"/);
  assert.match(html, /<div[^>]*class="pagination__summary"[^>]*>1 to 5 of 10<\/div>/);
  assert.match(html, /<ul[^>]*class="pagination__content"/);
  assert.equal(html.match(/data-slot="pagination-item"/g)?.length, 4);
  assert.match(html, /<button[^>]*aria-current="page"/);
  assert.match(html, /<button[^>]*data-active="true"/);
  assert.match(
    html,
    /class="pagination__link pagination__link--nav"[^>]*data-slot="pagination-previous"|data-slot="pagination-previous"[^>]*class="pagination__link pagination__link--nav"/,
  );
  assert.match(html, /<button[^>]*disabled/);
  assert.match(html, /data-slot="pagination-ellipsis"[^>]*>…<\/span>|>…<\/span>/);
  assert.match(html, /data-slot="pagination-previous-icon"><svg[^>]*width="16"[^>]*>.*?d="m15 18-6-6 6-6"/);
  assert.match(html, /data-slot="pagination-next-icon"><svg[^>]*width="16"[^>]*>.*?d="m9 18 6-6-6-6"/);
});

test("pagination SSR: auto form (total) = compound form", async () => {
  await assertSameHtml(
    () => <Pagination total={3} defaultPage={2} />,
    () => (
      <Pagination>
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous isDisabled={false}>
              <Pagination.PreviousIcon />
              <span>Previous</span>
            </Pagination.Previous>
          </Pagination.Item>
          <Pagination.Item>
            <Pagination.Link isActive={false}>{1}</Pagination.Link>
          </Pagination.Item>
          <Pagination.Item>
            <Pagination.Link isActive={true}>{2}</Pagination.Link>
          </Pagination.Item>
          <Pagination.Item>
            <Pagination.Link isActive={false}>{3}</Pagination.Link>
          </Pagination.Item>
          <Pagination.Item>
            <Pagination.Next isDisabled={false}>
              <span>Next</span>
              <Pagination.NextIcon />
            </Pagination.Next>
          </Pagination.Item>
        </Pagination.Content>
      </Pagination>
    ),
  );
});
