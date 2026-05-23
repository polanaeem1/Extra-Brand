import { createClient } from './browser';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export async function fetchProducts() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*), product_variants(*), product_colors(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error || !data?.length) {
    return [];
  }

  return data.map(mapSupabaseProduct);
}

export async function fetchProductById(id) {
  const supabase = createClient();

  const query = supabase
    .from('products')
    .select('*, product_images(*), product_variants(*), product_colors(*), product_reviews(*)')
    .eq('is_active', true);

  const { data, error } = await (UUID_PATTERN.test(id)
    ? query.eq('id', id)
    : query.eq('slug', id)
  ).maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapSupabaseProduct(data);
}
