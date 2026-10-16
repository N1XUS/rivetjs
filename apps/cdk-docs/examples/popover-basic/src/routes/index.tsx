import { Settings2 } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Popover } from "@rivetjs/cdk/popover";
import { Switch } from "@rivetjs/cdk/switch";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Popover" };

// #region demo
export default function Settings() {
  return (
    <section class="m-4 text-sm">
      <DialogTrigger>
        <Button id="settings-trigger" aria-label="Settings">
          <Icon icon={Settings2} size={18} />
        </Button>
        <Popover placement="bottom start">
          <Dialog id="settings-dialog" aria-label="Settings">
            <div class="grid gap-3">
              <Switch id="wifi" defaultSelected>
                Wi-Fi
              </Switch>
              <Switch id="bluetooth" defaultSelected>
                Bluetooth
              </Switch>
              <Switch id="mute">Mute</Switch>
            </div>
          </Dialog>
        </Popover>
      </DialogTrigger>
    </section>
  );
}
// #endregion
