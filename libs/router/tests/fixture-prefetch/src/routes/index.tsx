import { Link } from "@rivetjs/router/link";

export const head = { title: "Prefetch home" };
// Links of every kind the document prefetch must take or skip (`tests/prefetch.test.ts`). Skipped links
// get URLs of their own: Chromium starts a rule's prefetch from any link with a candidate's URL.
export default function Home() {
  return (
    <>
      <h1>Home</h1>
      <ul>
        <li>
          <Link to="/a" reload id="doc">
            Document A
          </Link>
        </li>
        <li>
          <Link to="/b" reload prefetch="prerender" id="pre">
            Prerender B
          </Link>
        </li>
        <li>
          <a href="/c" data-rivet-reload="" id="plain">
            Plain C
          </a>
        </li>
        <li>
          <Link to="/c?none" reload prefetch="none" id="none">
            None C
          </Link>
        </li>
        <li>
          <Link to="/a?routed" id="routed">
            Routed A
          </Link>
        </li>
        <li>
          <a href="/legacy/" id="unknown">
            Not a route (no reload mark: a document load all the same)
          </a>
        </li>
        <li>
          <a href="/c?download" data-rivet-reload="" download id="download">
            Download C
          </a>
        </li>
        <li>
          <a href="/c?blank" data-rivet-reload="" target="_blank" id="blank">
            New tab C
          </a>
        </li>
        <li>
          <a href="https://example.com/" data-rivet-reload="" id="external">
            External
          </a>
        </li>
        <li>
          <a href="/" data-rivet-reload="" id="self">
            Self
          </a>
        </li>
      </ul>
    </>
  );
}
