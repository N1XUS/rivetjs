export interface Incident {
  id: number;
  title: string;
  severity: string;
  notes: { id: string; text: string }[];
}
export function incidents(count = 120): Incident[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Incident ${String(i + 1).padStart(3, "0")}`,
    severity: i % 3 === 0 ? "critical" : "normal",
    notes: [
      { id: `${i + 1}-1`, text: "Investigating" },
      { id: `${i + 1}-2`, text: "Assigned" },
    ],
  }));
}
