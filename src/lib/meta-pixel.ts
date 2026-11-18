/**
 * Meta Pixel browser-side tracking utility for MeatBond Mart.
 *
 * Privacy & Security:
 * - NO customer PII (names, emails, phone numbers, addresses, passwords) is ever sent.
 * - Only standard catalog metadata (product IDs, quantities, prices in BDT) and order references.
 * - Deduplication for Purchase events is enforced via browser storage and eventID.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
  }
}

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function getMetaPixelId(): string | undefined {
  return process.env.NEXT_PUBLIC_META_PIXEL_ID;
}

/** Check marketing cookie consent. Defaults to true if no consent manager is installed. */
export function hasMarketingConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const consent = localStorage.getItem("mbm_cookie_consent");
    if (consent === "rejected" || consent === "denied") return false;
  } catch {
    // Ignore storage errors (private browsing, quotas)
  }
  return true;
}

export function isPixelReady(): boolean {
  return typeof window !== "undefined" && Boolean(getMetaPixelId()) && hasMarketingConsent();
}

/**
 * Safe invocation of window.fbq.
 * Queues calls if the library has not fully initialized yet.
 */
export function fbq(...args: unknown[]): void {
  if (typeof window === "undefined" || !isPixelReady()) return;

  if (typeof window.fbq === "function") {
    window.fbq(...args);
    return;
  }

  // Fallback queue before fbevents.js executes
  interface FbqStub {
    (...fnArgs: unknown[]): void;
    callMethod?: (...fnArgs: unknown[]) => void;
    queue: unknown[][];
    loaded: boolean;
    version: string;
    push: unknown;
  }

  const n: FbqStub = function (...fnArgs: unknown[]) {
    if (n.callMethod) {
      n.callMethod(...fnArgs);
    } else {
      n.queue.push(fnArgs);
    }
  } as FbqStub;

  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = false;
  n.version = "2.0";
  n.queue = [];
  window.fbq = n;
  window.fbq(...args);
}

/** Standard PageView */
export function trackPageView(): void {
  fbq("track", "PageView");
}

/** ViewContent (Product detail page) */
export interface ViewContentParams {
  id: string;
  name: string;
  price: number;
  category?: string;
  currency?: string;
}

export function trackViewContent(params: ViewContentParams): void {
  fbq("track", "ViewContent", {
    content_name: params.name,
    content_category: params.category || "Meat & Poultry",
    content_ids: [params.id],
    content_type: "product",
    value: params.price,
    currency: params.currency || "BDT",
  });
}

/** AddToCart (Product added to cart) */
export interface AddToCartParams {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  currency?: string;
}

export function trackAddToCart(params: AddToCartParams): void {
  const value = params.price * params.quantity;
  fbq("track", "AddToCart", {
    content_name: params.name,
    content_category: params.category || "Meat & Poultry",
    content_ids: [params.id],
    content_type: "product",
    value,
    currency: params.currency || "BDT",
    contents: [
      {
        id: params.id,
        quantity: params.quantity,
        item_price: params.price,
      },
    ],
  });
}

/** InitiateCheckout (Checkout started with active cart items) */
export interface CheckoutLineItem {
  id: string;
  name?: string;
  price: number;
  quantity: number;
}

export interface InitiateCheckoutParams {
  items: CheckoutLineItem[];
  subtotal: number;
  currency?: string;
}

export function trackInitiateCheckout(params: InitiateCheckoutParams): void {
  const content_ids = params.items.map((i) => i.id);
  const num_items = params.items.reduce((acc, i) => acc + i.quantity, 0);
  const contents = params.items.map((i) => ({
    id: i.id,
    quantity: i.quantity,
    item_price: i.price,
  }));

  fbq("track", "InitiateCheckout", {
    content_ids,
    content_type: "product",
    value: params.subtotal,
    currency: params.currency || "BDT",
    num_items,
    contents,
  });
}

/** Purchase (Fired ONLY after backend order confirmation) */
export interface PurchaseParams {
  reference: string;
  total: number;
  items: CheckoutLineItem[];
  currency?: string;
}

const PURCHASE_TRACKED_KEY = "mbm_tracked_purchases";

export function hasOrderBeenTracked(reference: string): boolean {
  if (typeof window === "undefined" || !reference) return false;
  try {
    const raw = sessionStorage.getItem(PURCHASE_TRACKED_KEY) || localStorage.getItem(PURCHASE_TRACKED_KEY);
    if (!raw) return false;
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) && list.includes(reference);
  } catch {
    return false;
  }
}

export function markOrderAsTracked(reference: string): void {
  if (typeof window === "undefined" || !reference) return;
  try {
    const raw = sessionStorage.getItem(PURCHASE_TRACKED_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(reference)) {
      list.push(reference);
      const str = JSON.stringify(list);
      sessionStorage.setItem(PURCHASE_TRACKED_KEY, str);
      localStorage.setItem(PURCHASE_TRACKED_KEY, str);
    }
  } catch {
    // Ignore quota or security errors
  }
}

export function trackPurchase(params: PurchaseParams): boolean {
  if (!params.reference) return false;
  if (hasOrderBeenTracked(params.reference)) {
    return false; // Deduplicate: never fire twice for same reference
  }

  const content_ids = params.items.map((i) => i.id);
  const num_items = params.items.reduce((acc, i) => acc + i.quantity, 0);
  const contents = params.items.map((i) => ({
    id: i.id,
    quantity: i.quantity,
    item_price: i.price,
  }));

  fbq(
    "track",
    "Purchase",
    {
      content_ids,
      content_type: "product",
      value: params.total,
      currency: params.currency || "BDT",
      num_items,
      contents,
    },
    { eventID: params.reference }
  );

  markOrderAsTracked(params.reference);
  return true;
}
