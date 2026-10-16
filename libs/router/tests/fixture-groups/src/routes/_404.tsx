export default function NotFound(props: { url: URL }) {
  return <h1 id="not-found">Not found {props.url.pathname}</h1>;
}
