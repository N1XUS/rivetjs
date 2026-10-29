// Rivet-authored NativeSelect demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Label } from "@rivetjs/ui/label";
import { NativeSelect } from "@rivetjs/ui/native-select";

export const head = { title: "NativeSelect: With Groups" };

// #region demo
export function WithGroups() {
  return (
    <NativeSelect class="w-64" defaultValue="lisbon">
      <Label>Office</Label>
      <NativeSelect.Trigger>
        <NativeSelect.OptGroup label="Europe">
          <NativeSelect.Option value="lisbon">Lisbon</NativeSelect.Option>
          <NativeSelect.Option value="krakow">Krakow</NativeSelect.Option>
        </NativeSelect.OptGroup>
        <NativeSelect.OptGroup label="Americas">
          <NativeSelect.Option value="austin">Austin</NativeSelect.Option>
          <NativeSelect.Option value="bogota">Bogota</NativeSelect.Option>
        </NativeSelect.OptGroup>
        <NativeSelect.OptGroup label="Asia Pacific">
          <NativeSelect.Option value="seoul">Seoul</NativeSelect.Option>
        </NativeSelect.OptGroup>
      </NativeSelect.Trigger>
    </NativeSelect>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithGroups />
    </div>
  );
}
