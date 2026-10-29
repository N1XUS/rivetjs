// Rivet-authored Sheet demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";
import { Slider } from "@rivetjs/ui/slider";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "Sheet: Handle Only" };

// #region demo
export function HandleOnly() {
  return (
    <Sheet isHandleOnly>
      <Button variant="secondary">Adjust volume</Button>
      <Sheet.Backdrop>
        <Sheet.Content>
          <Sheet.Dialog>
            <Sheet.Handle />
            <Sheet.Header>
              <Sheet.Heading>Volume</Sheet.Heading>
            </Sheet.Header>
            <Sheet.Body>
              <Slider defaultValue={40} class="w-full">
                <Label>Master</Label>
                <Slider.Output />
                <Slider.Track>
                  <Slider.Fill />
                  <Slider.Thumb />
                </Slider.Track>
              </Slider>
            </Sheet.Body>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <HandleOnly />
    </div>
  );
}
