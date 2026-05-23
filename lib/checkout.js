const STORAGE_KEY = 'extraCheckout';

export function saveCheckout(items, source = 'buy-now') {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ items, source }));
}

export function loadCheckout() {
  if (typeof window === 'undefined') return null;

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCheckout() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function normalizeCheckoutItem(item) {
  return {
    productId: item.productId || '',
    variantId: item.variantId || '',
    name: item.name || '',
    price: Number(item.price || 0),
    qty: Number(item.qty || 1),
    size: item.size || '',
    color: item.color || '',
    img: item.img || '',
  };
}
