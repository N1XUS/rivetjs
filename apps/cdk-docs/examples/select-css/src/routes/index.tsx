import { Select } from "@rivetjs/cdk/select";
import { ChevronDown } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Select with CSS" };

const cities = [
  { key: "oslo", label: "Oslo" },
  { key: "rome", label: "Rome" },
  { key: "tokyo", label: "Tokyo", disabled: true },
  { key: "lima", label: "Lima" },
];

// #region demo
export default function Cities() {
  return (
    <section class="demo">
      <Select id="city" label="City" items={cities} indicator={() => <Icon icon={ChevronDown} />} />
      <Select id="bad" label="Required city" items={cities} isRequired isInvalid errorMessage="Pick a city." />
    </section>
  );
}
// #endregion
