export default function NoItem({ url }: { url: URL }) {
  return <h1 id="no-item">No item at {url.pathname}</h1>;
}
