import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { FileTrigger } from "@rivetjs/cdk/file-trigger";
import { Label } from "@rivetjs/cdk/label";
import { Meter } from "@rivetjs/cdk/meter";
import { ProgressBar } from "@rivetjs/cdk/progress-bar";

export const head = { title: "Meter / ProgressBar / FileTrigger" };

export default function ProgressStory() {
  const progress = signal(25);
  const files = signal("none");
  return (
    <section>
      <h1>Meter / ProgressBar / FileTrigger</h1>
      <Meter id="storage" value={60}>
        {({ percentage, valueText }) => (
          <>
            <Label>Storage space</Label>
            <span class="value">{valueText()}</span>
            <div class="bar" style={{ width: percentage() + "%" }} />
          </>
        )}
      </Meter>
      <ProgressBar id="upload" value={() => progress()}>
        {({ percentage, valueText }) => (
          <>
            <Label>Uploading…</Label>
            <span class="value">{valueText()}</span>
            <div class="bar" style={{ width: percentage() + "%" }} />
          </>
        )}
      </ProgressBar>
      <Button id="advance" onPress={() => progress.set(Math.min(100, progress() + 25))}>
        Advance
      </Button>
      <ProgressBar id="busy" isIndeterminate aria-label="Loading" />
      <FileTrigger allowsMultiple acceptedFileTypes={["text/plain"]} data-testid="files" onSelect={(list) => files.set(list ? [...list].map((f) => f.name).join(",") : "none")}>
        <Button id="pick">Select files</Button>
      </FileTrigger>
      <output id="files-value">{files()}</output>
    </section>
  );
}
