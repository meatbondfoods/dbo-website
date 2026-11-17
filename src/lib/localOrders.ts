// Demo account storage: orders placed on this device, kept in localStorage.
// With real accounts this moves server-side behind authentication.
const KEY = "mart-orders";
export interface LocalOrder { reference: string; phone: string }

export function getLocalOrders(): LocalOrder[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
export function rememberOrder(reference: string, phone: string) {
  try {
    const list = getLocalOrders().filter((o) => o.reference !== reference);
    localStorage.setItem(KEY, JSON.stringify([{ reference, phone }, ...list].slice(0, 50)));
  } catch { /* storage unavailable: tracking by reference + phone still works */ }
}
