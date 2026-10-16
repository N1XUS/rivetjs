// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/calendar/custom-icons.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { ArrowLeft, ArrowRight } from "lucide";
import { Calendar } from "@rivetjs/ui/calendar";

export const head = { title: "Calendar: Custom Navigation Icons" };

// #region demo
// Rivet: upstream inline material-icon svgs → lucide icons (icon rule: no hand-written SVG paths).
export function CustomIcons() {
  return (
    <Calendar aria-label="Event date">
      <Calendar.Header>
        <Calendar.Heading />
        <Calendar.NavButton slot="previous">
          <Icon icon={ArrowLeft} size={24} />
        </Calendar.NavButton>
        <Calendar.NavButton slot="next">
          <Icon icon={ArrowRight} size={24} />
        </Calendar.NavButton>
      </Calendar.Header>
      <Calendar.Grid>
        <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
        <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
      </Calendar.Grid>
    </Calendar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomIcons />
    </div>
  );
}
