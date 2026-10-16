import { ReadingList } from "../components/ReadingList.tsx";

export const head = { title: "Reading list" };

// The page at `/`. The layout adds the navigation around it.
export default function Home() {
  return (
    <>
      <h1 class="text-2xl font-bold">My reading list</h1>
      <ReadingList />
    </>
  );
}
