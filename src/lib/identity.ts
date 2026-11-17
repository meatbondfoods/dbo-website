// Identity helpers shared by the API layer and (mirrored in SQL by) migrations 101/103.
// No imports and no path aliases, so it can be unit-tested directly with node --test.

/** Bangladesh mobile -> E.164 (+8801XXXXXXXXX), or null. Mirrors public.normalize_bd_phone(). */
export function normalizeBdPhone(input: string): string | null {
  const d = (input ?? "").replace(/[^0-9]/g, "");
  if (/^8801[3-9][0-9]{8}$/.test(d)) return `+${d}`;
  if (/^01[3-9][0-9]{8}$/.test(d)) return `+88${d}`;
  return null;
}

export const CUSTOMER_CODE_RE = /^MBM-CUS-\d{6,}$/;
export const ORDER_REF_RE = /^MBM-ORD-\d{4}-\d{6,}$/;

/** MBM-CUS-000001. Assigned by a database sequence; this only formats/validates. */
export function formatCustomerCode(n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new RangeError("Customer sequence must be a positive integer");
  return `MBM-CUS-${String(n).padStart(6, "0")}`;
}

/** MBM-ORD-2026-000001. Assigned by a yearly database counter; this only formats/validates. */
export function formatOrderReference(year: number, n: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) throw new RangeError("Invalid year");
  if (!Number.isInteger(n) || n < 1) throw new RangeError("Order sequence must be a positive integer");
  return `MBM-ORD-${year}-${String(n).padStart(6, "0")}`;
}
