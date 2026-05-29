export const TRANSACTION_EDIT_MODE_COOKIE = "transaction_edit_mode";

export function isTransactionEditModeEnabled(value: string | undefined) {
  return value === "1";
}
