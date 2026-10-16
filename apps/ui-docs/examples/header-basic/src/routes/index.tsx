import { Header } from "@rivetjs/ui/header";
import { Separator } from "@rivetjs/ui/separator";

export const head = { title: "Header" };

// #region demo
export default function HeaderBasic() {
  return (
    <div class="flex max-w-xs flex-col gap-2 p-6 text-sm">
      <Header id="recent">Recent files</Header>
      <span>report-q3.pdf</span>
      <span>roadmap.md</span>
      <Separator />
      <Header>Shared with you</Header>
      <span>brand-assets.zip</span>
    </div>
  );
}
// #endregion
