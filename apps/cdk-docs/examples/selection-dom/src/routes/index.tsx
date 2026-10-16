import { FileList } from "../components/FileList.tsx";

export const head = { title: "Selection" };

export default function Files() {
  return (
    <section class="m-4 max-w-xs text-sm">
      <FileList />
    </section>
  );
}
