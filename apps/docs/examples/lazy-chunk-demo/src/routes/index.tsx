import { LikeButton } from "../components/LikeButton.tsx";
import { MoreInfo } from "../components/MoreInfo.tsx";

export const head = { title: "Code per component" };

// The page itself has no browser code. Each component brings its own small file.
export default function Home() {
  return (
    <div class="m-4 space-y-3">
      <h1 class="text-xl font-bold">Dune</h1>
      <LikeButton />
      <MoreInfo />
    </div>
  );
}
