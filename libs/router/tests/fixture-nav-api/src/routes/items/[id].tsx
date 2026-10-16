import { navigate, setSearchParams, useParams, useSearchParams } from "@rivetjs/router/client";

export default function Item() {
  const params = useParams<"items/[id]">();
  const search = useSearchParams();
  return (
    <section>
      <h1>Item {params().id}</h1>
      <p id="id">{params().id}</p>
      <p id="q">{search().get("q") ?? "-"}</p>
      <button type="button" id="next" onClick={() => navigate(`/items/${Number(params().id) + 1}`)}>
        Next
      </button>
      <button type="button" id="set-q" onClick={() => setSearchParams((current) => current.set("q", "y")).then(() => (document.documentElement.dataset.done = "q"))}>
        Set q
      </button>
    </section>
  );
}
