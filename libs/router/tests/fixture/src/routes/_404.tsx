export default function NotFound({ url }: { url: URL }) {
  return <h1 id="not-found">Nothing at {url.pathname}</h1>;
}
