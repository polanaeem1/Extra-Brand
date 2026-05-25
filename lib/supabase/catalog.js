import { createClient } from './browser';
import { logSupabaseRequest } from './debug';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_CACHE_MS = 60_000;
const PRODUCT_DETAIL_CACHE_MS = 30_000;
let productsCache = { value: null, expiresAt: 0, promise: null };
const productDetailCache = new Map();

export function mapSupabaseProduct(row) {
  const images = (row.product_images || [])
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((image) => image.url);

  const variants = row.product_variants || [];
  const colors = row.product_colors || [];
  const reviews = row.product_reviews || [];

  return {
    id: row.id,
    slug: row.slug,
    title: row.name,
    description: row.description || '',
    sizeChartUrl: row.size_chart_url || '',
    price: Number(row.price || 0),
    priceLabel: `LE ${Number(row.price || 0).toFixed(2)}`,
    category: row.category || '',
    images,
    variants,
    colors: colors.filter((c) => Number(c.stock || 0) > 0).map((c) => c.color),
    colorVariants: colors.map((c) => ({ color: c.color, stock: Number(c.stock || 0) })),
    reviews: reviews
      .filter((r) => r.is_approved)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((r) => ({
        id: r.id,
        name: r.customer_name,
        rating: Number(r.rating || 5),
        text: r.review_text,
      })),
  };
}

export function invalidateProductsCache() {
  productsCache = { value: null, expiresAt: 0, promise: null };
  productDetailCache.clear();
}

export async function fetchProducts(options = {}) {
  const force = !!options.force;
  const now = Date.now();

  if (!force && productsCache.value && productsCache.expiresAt > now) {
    return productsCache.value;
  }

  if (!force && productsCache.promise) {
    return productsCache.promise;
  }

  const supabase = createClient();
  logSupabaseRequest('catalog.fetchProducts');
  productsCache.promise = supabase
    .from('products')
    .select('*, product_images(*), product_variants(*), product_colors(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .then(({ data, error }) => {
      if (error || !data?.length) {
        productsCache.value = [];
        productsCache.expiresAt = Date.now() + 10_000;
        return [];
      }

      const mapped = data.map(mapSupabaseProduct);
      productsCache.value = mapped;
      productsCache.expiresAt = Date.now() + PRODUCT_CACHE_MS;
      return mapped;
    })
    .finally(() => {
      productsCache.promise = null;
    });

  return productsCache.promise;
}

export async function fetchProductById(id, options = {}) {
  const key = String(id || '');
  const force = !!options.force;
  const now = Date.now();

  if (!force) {
    const cached = productDetailCache.get(key);
    if (cached?.value && cached.expiresAt > now) return cached.value;
    if (cached?.promise) return cached.promise;
  }

  const supabase = createClient();
  logSupabaseRequest('catalog.fetchProductById', id);

  const query = supabase
    .from('products')
    .select('*, product_images(*), product_variants(*), product_colors(*), product_reviews(*)')
    .eq('is_active', true);

  const promise = (UUID_PATTERN.test(id)
    ? query.eq('id', id)
    : query.eq('slug', id)
  ).maybeSingle().then(({ data, error }) => {
    const value = error || !data ? null : mapSupabaseProduct(data);
    productDetailCache.set(key, {
      value,
      expiresAt: Date.now() + PRODUCT_DETAIL_CACHE_MS,
      promise: null,
    });
    return value;
  }).catch(() => {
    productDetailCache.set(key, {
      value: null,
      expiresAt: Date.now() + 5_000,
      promise: null,
    });
    return null;
  });

  productDetailCache.set(key, { value: null, expiresAt: 0, promise });
  return promise;
}
