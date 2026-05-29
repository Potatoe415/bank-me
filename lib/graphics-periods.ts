export type PeriodOption = {
  value: string;
  label: string;
  days: number | null;
};

export const DEFAULT_GRAPHICS_PERIOD = "90d";

export const GRAPHICS_PERIOD_OPTIONS: PeriodOption[] = [
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
  { value: "180d", label: "6 months", days: 180 },
  { value: "365d", label: "12 months", days: 365 },
  { value: "1095d", label: "3 last years", days: 1095 },
  { value: "all", label: "All time", days: null },
];

export function getGraphicsPeriod(periodValue: string | undefined) {
  return GRAPHICS_PERIOD_OPTIONS.find((option) => option.value === periodValue)
    ?? GRAPHICS_PERIOD_OPTIONS.find((option) => option.value === DEFAULT_GRAPHICS_PERIOD)
    ?? GRAPHICS_PERIOD_OPTIONS[0];
}

export function getSinceIso(days: number | null) {
  if (days === null) return null;
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date.toISOString();
}
