export default function Item({ params }: { params: { id: string } }) {
  return <h1 id="item">Item {params.id}</h1>;
}
