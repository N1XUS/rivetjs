// ui page-CSS fixture: Button only (identity lane CSS split measurement).
import { Button } from "@rivetjs/ui/button";

export default function Page() {
  return (
    <main>
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
    </main>
  );
}
