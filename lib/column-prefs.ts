export const COLUMN_PREFS_COOKIE = "column_hidden_prefs";

export type ColumnId =
  | "bank"
  | "type"
  | "description"
  | "counterpart"
  | "card"
  | "value_date"
  | "category"
  | "source"
  | "confidence"
  | "review_status";

export const ALL_COLUMNS: Array<{ id: ColumnId; label: string }> = [
  { id: "bank", label: "Bank" },
  { id: "type", label: "Type" },
  { id: "description", label: "Description" },
  { id: "counterpart", label: "Counterpart" },
  { id: "card", label: "Card" },
  { id: "value_date", label: "Value date" },
  { id: "category", label: "Category" },
  { id: "source", label: "Source" },
  { id: "confidence", label: "Confidence" },
  { id: "review_status", label: "Status" },
];

export const DEFAULT_HIDDEN: ColumnId[] = ["card", "value_date"];

const VALID_IDS = new Set(ALL_COLUMNS.map((c) => c.id));

export function parseHiddenColumns(cookieValue: string | undefined): Set<ColumnId> {
  if (cookieValue === undefined) {
    return new Set(DEFAULT_HIDDEN);
  }
  if (cookieValue === "") {
    return new Set();
  }
  const parsed = cookieValue
    .split(",")
    .filter((id): id is ColumnId => VALID_IDS.has(id as ColumnId));
  return new Set(parsed);
}

export function serializeHiddenColumns(hidden: ColumnId[]): string {
  return hidden.join(",");
}
