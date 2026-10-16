import { signal } from "@rivetjs/reactivity";
import { Rating } from "../components/Rating.tsx";

export const head = { title: "Rating" };

export default function Home() {
  const rating = signal(3);
  return (
    <main class="p-6">
      <Rating value={rating()} onChange={(value) => rating.set(value)} />
      <p id="value">Rating: {rating()}</p>
    </main>
  );
}
