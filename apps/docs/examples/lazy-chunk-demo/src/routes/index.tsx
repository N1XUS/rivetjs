import { LikeButton } from "../components/LikeButton.tsx";
import { MoreInfo } from "../components/MoreInfo.tsx";

export const head = { title: "Code per page" };

// The page writes no browser code of its own. The handlers of both components go into one small file for this page.
export default function Home() {
  return (
    <div class="m-4 space-y-3">
      <h1 class="text-xl font-bold">Dune</h1>
      <LikeButton />
      <MoreInfo />
    </div>
  );
}
