-- EXTRA Supabase setup. Run this in the Supabase SQL editor.
-- This project intentionally uses only the publishable key from the app.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  status text not null default 'active' check (status in ('active', 'banned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  sku text,
  stock int not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size)
);

-- Product colors with per-color stock (independent of size stock).
create table if not exists public.product_colors (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  color text not null,
  stock int not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, color)
);

create index if not exists product_colors_product_id_idx on public.product_colors (product_id);
create index if not exists product_colors_color_idx on public.product_colors (color);

-- Customer reviews (admin-managed for now).
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  customer_name text not null,
  rating int not null check (rating >= 1 and rating <= 5),
  review_text text not null,
  is_approved boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_reviews_product_id_idx on public.product_reviews (product_id);
create index if not exists product_reviews_created_at_idx on public.product_reviews (created_at desc);

-- Contact messages (submitted from Contact Us page).
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  visitor_id text,
  user_id uuid references auth.users(id),
  name text not null,
  email text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_is_read_idx on public.contact_messages (is_read);

-- Promo codes (admin-managed, validated on the backend).
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  discount_percentage numeric(5,2) not null check (discount_percentage > 0 and discount_percentage <= 100),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  usage_limit int,
  used_count int not null default 0,
  minimum_order_amount numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code),
  check (code = upper(code)),
  check (usage_limit is null or usage_limit >= 0),
  check (used_count >= 0),
  check (minimum_order_amount is null or minimum_order_amount >= 0)
);

create index if not exists promo_codes_code_idx on public.promo_codes (code);
create index if not exists promo_codes_active_idx on public.promo_codes (is_active);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default ('ORD-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  -- Optional attribution fields for analytics/funnel linking.
  visitor_id text,
  user_id uuid references auth.users(id),
  -- Promo codes / discounts (stored on the order for auditing)
  promo_code text,
  discount_percentage numeric(5,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  final_total numeric(10,2),
  customer_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  city text,
  notes text,
  shipping_fee numeric(10,2) not null default 0,
  subtotal numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  payment_method text not null check (payment_method in ('COD', 'Instapay', 'Vodafone')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'rejected')),
  status text not null default 'Pending' check (status in ('Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled')),
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backward-compatible: if the orders table already exists, ensure new columns exist.
alter table public.orders add column if not exists visitor_id text;
alter table public.orders add column if not exists user_id uuid references auth.users(id);
alter table public.orders add column if not exists promo_code text;
alter table public.orders add column if not exists discount_percentage numeric(5,2) not null default 0;
alter table public.orders add column if not exists discount_amount numeric(10,2) not null default 0;
alter table public.orders add column if not exists final_total numeric(10,2);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  variant_id uuid references public.product_variants(id),
  product_name text not null,
  size text not null,
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  line_total numeric(10,2) not null,
  created_at timestamptz not null default now()
);

-- Backward-compatible: ensure deleting products/variants does not break order history.
-- Orders keep product_name/size/unit_price snapshots, so FK can safely set null.
alter table public.order_items drop constraint if exists order_items_product_id_fkey;
alter table public.order_items
add constraint order_items_product_id_fkey
foreign key (product_id) references public.products(id) on delete set null;

alter table public.order_items drop constraint if exists order_items_variant_id_fkey;
alter table public.order_items
add constraint order_items_variant_id_fkey
foreign key (variant_id) references public.product_variants(id) on delete set null;

create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  source text not null default 'Direct',
  referrer text,
  visitor_id text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- New analytics table (traffic sources + daily visitors, using only the public key + RLS).
create table if not exists public.analytics_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  page_path text not null,
  visit_date date not null default current_date,
  referrer text,
  traffic_source text not null default 'Direct',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Add-to-cart tracking for funnel analytics.
create table if not exists public.cart_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  user_id uuid references auth.users(id),
  product_id uuid references public.products(id),
  variant_id uuid references public.product_variants(id),
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists cart_events_created_at_idx on public.cart_events (created_at desc);
create index if not exists cart_events_visitor_id_idx on public.cart_events (visitor_id);
create index if not exists cart_events_user_id_idx on public.cart_events (user_id);

-- Backward-compatible: if the analytics_visits table already exists, ensure visit_date exists.
alter table public.analytics_visits add column if not exists visit_date date not null default current_date;

create index if not exists analytics_visits_created_at_idx on public.analytics_visits (created_at desc);
create index if not exists analytics_visits_visit_date_idx on public.analytics_visits (visit_date desc);
create index if not exists analytics_visits_visitor_id_idx on public.analytics_visits (visitor_id);
create index if not exists analytics_visits_traffic_source_idx on public.analytics_visits (traffic_source);

-- Remove the old dedupe index (it used a non-IMMUTABLE expression on timestamptz -> date).
drop index if exists public.analytics_visits_unique_daily_path_idx;

-- Optional dedupe to reduce noise from refreshes (same visitor + same page on the same day).
create unique index if not exists analytics_visits_unique_daily_page
on public.analytics_visits (visitor_id, page_path, visit_date);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists promo_codes_set_updated_at on public.promo_codes;
create trigger promo_codes_set_updated_at
before update on public.promo_codes
for each row execute function public.set_updated_at();

drop trigger if exists product_colors_set_updated_at on public.product_colors;
create trigger product_colors_set_updated_at
before update on public.product_colors
for each row execute function public.set_updated_at();

drop trigger if exists product_reviews_set_updated_at on public.product_reviews;
create trigger product_reviews_set_updated_at
before update on public.product_reviews
for each row execute function public.set_updated_at();

create or replace function public.validate_promo_code(p_code text, p_subtotal numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  promo public.promo_codes;
  normalized text;
  discount_pct numeric(5,2);
  discount_amt numeric(10,2);
begin
  normalized := upper(trim(coalesce(p_code, '')));

  if normalized = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;

  select *
  into promo
  from public.promo_codes
  where code = normalized;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if promo.is_active is not true then
    return jsonb_build_object('ok', false, 'reason', 'inactive');
  end if;

  if promo.starts_at > now() then
    return jsonb_build_object('ok', false, 'reason', 'not_started');
  end if;

  if promo.expires_at is not null and promo.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if promo.usage_limit is not null and promo.used_count >= promo.usage_limit then
    return jsonb_build_object('ok', false, 'reason', 'limit_reached');
  end if;

  if promo.minimum_order_amount is not null and coalesce(p_subtotal, 0) < promo.minimum_order_amount then
    return jsonb_build_object('ok', false, 'reason', 'min_not_met', 'minimum_order_amount', promo.minimum_order_amount);
  end if;

  discount_pct := promo.discount_percentage;
  discount_amt := round((coalesce(p_subtotal, 0) * discount_pct / 100)::numeric, 2);

  return jsonb_build_object(
    'ok', true,
    'code', promo.code,
    'discount_percentage', discount_pct,
    'discount_amount', discount_amt
  );
end;
$$;

grant execute on function public.validate_promo_code(text, numeric) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, first_name, last_name, phone, role, status
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'customer',
    'active'
  )
  on conflict (id) do update set
    email = excluded.email,
    first_name = coalesce(nullif(excluded.first_name, ''), public.profiles.first_name),
    last_name = coalesce(nullif(excluded.last_name, ''), public.profiles.last_name),
    phone = coalesce(nullif(excluded.phone, ''), public.profiles.phone),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.create_order_with_items(order_payload jsonb, items_payload jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  created_order public.orders;
  item jsonb;
  variant_record public.product_variants;
  item_quantity int;
  v_shipping_fee numeric(10,2);
  v_subtotal numeric(10,2);
  v_total numeric(10,2);
  v_promo_code text;
  v_discount_pct numeric(5,2) := 0;
  v_discount_amt numeric(10,2) := 0;
  v_final_total numeric(10,2);
  promo_record public.promo_codes;
begin
  v_shipping_fee := coalesce((order_payload->>'shipping_fee')::numeric, 0);
  v_subtotal := coalesce((order_payload->>'subtotal')::numeric, 0);
  v_total := round((v_subtotal + v_shipping_fee)::numeric, 2);
  v_promo_code := upper(trim(coalesce(order_payload->>'promo_code', '')));

  if v_promo_code <> '' then
    select *
    into promo_record
    from public.promo_codes
    where code = v_promo_code
    for update;

    if not found then
      raise exception 'Invalid promo code.';
    end if;

    if promo_record.is_active is not true then
      raise exception 'Promo code is inactive.';
    end if;

    if promo_record.starts_at > now() then
      raise exception 'Promo code is not started yet.';
    end if;

    if promo_record.expires_at is not null and promo_record.expires_at <= now() then
      raise exception 'Promo code expired.';
    end if;

    if promo_record.usage_limit is not null and promo_record.used_count >= promo_record.usage_limit then
      raise exception 'Promo code usage limit reached.';
    end if;

    if promo_record.minimum_order_amount is not null and v_subtotal < promo_record.minimum_order_amount then
      raise exception 'Minimum order amount not met.';
    end if;

    v_discount_pct := promo_record.discount_percentage;
    v_discount_amt := round((v_subtotal * v_discount_pct / 100)::numeric, 2);

    if v_discount_amt < 0 then v_discount_amt := 0; end if;
    if v_discount_amt > v_subtotal then v_discount_amt := v_subtotal; end if;

    update public.promo_codes
    set used_count = used_count + 1, updated_at = now()
    where id = promo_record.id;
  else
    v_promo_code := null;
  end if;

  v_final_total := round(((v_subtotal - v_discount_amt) + v_shipping_fee)::numeric, 2);
  if v_final_total < 0 then v_final_total := 0; end if;

  insert into public.orders (
    visitor_id, user_id,
    promo_code, discount_percentage, discount_amount, final_total,
    customer_name, email, phone, address, city, notes,
    shipping_fee, subtotal, total, payment_method, payment_status, receipt_url
  )
  values (
    nullif(order_payload->>'visitor_id', ''),
    auth.uid(),
    v_promo_code,
    coalesce(v_discount_pct, 0),
    coalesce(v_discount_amt, 0),
    v_final_total,
    order_payload->>'customer_name',
    order_payload->>'email',
    order_payload->>'phone',
    order_payload->>'address',
    order_payload->>'city',
    order_payload->>'notes',
    v_shipping_fee,
    v_subtotal,
    v_final_total,
    order_payload->>'payment_method',
    coalesce(order_payload->>'payment_status', 'pending'),
    order_payload->>'receipt_url'
  )
  returning * into created_order;

  for item in select * from jsonb_array_elements(items_payload)
  loop
    item_quantity := coalesce((item->>'quantity')::int, 1);

    if item ? 'variant_id' and nullif(item->>'variant_id', '') is not null then
      select * into variant_record
      from public.product_variants
      where id = (item->>'variant_id')::uuid
      for update;

      if not found then
        raise exception 'Selected size is unavailable.';
      end if;

      if variant_record.stock < item_quantity then
        raise exception 'Not enough stock for selected size.';
      end if;

      update public.product_variants
      set stock = stock - item_quantity, updated_at = now()
      where id = variant_record.id;
    end if;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name, size,
      quantity, unit_price, line_total
    )
    values (
      created_order.id,
      nullif(item->>'product_id', '')::uuid,
      nullif(item->>'variant_id', '')::uuid,
      item->>'product_name',
      item->>'size',
      item_quantity,
      coalesce((item->>'unit_price')::numeric, 0),
      coalesce((item->>'line_total')::numeric, 0)
    );
  end loop;

  return created_order;
end;
$$;

grant execute on function public.create_order_with_items(jsonb, jsonb) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_colors enable row level security;
alter table public.product_reviews enable row level security;
alter table public.contact_messages enable row level security;
alter table public.promo_codes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.page_views enable row level security;
alter table public.analytics_visits enable row level security;
alter table public.cart_events enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_insert_self_customer" on public.profiles;
create policy "profiles_insert_self_customer" on public.profiles
for insert with check (
  auth.uid() = id
  and role = 'customer'
  and status = 'active'
);

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
drop policy if exists "profiles_update_self_customer" on public.profiles;
create policy "profiles_update_self_customer" on public.profiles
for update using (auth.uid() = id and role = 'customer')
with check (
  auth.uid() = id
  and role = 'customer'
  and status = 'active'
);

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products_public_read_active" on public.products;
create policy "products_public_read_active" on public.products
for select using (is_active = true or public.is_admin());

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "product_images_public_read" on public.product_images;
create policy "product_images_public_read" on public.product_images
for select using (
  public.is_admin()
  or exists (select 1 from public.products p where p.id = product_id and p.is_active = true)
);

drop policy if exists "product_images_admin_write" on public.product_images;
create policy "product_images_admin_write" on public.product_images
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "product_variants_public_read" on public.product_variants;
create policy "product_variants_public_read" on public.product_variants
for select using (
  public.is_admin()
  or exists (select 1 from public.products p where p.id = product_id and p.is_active = true)
);

drop policy if exists "product_variants_admin_write" on public.product_variants;
create policy "product_variants_admin_write" on public.product_variants
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "product_colors_public_read" on public.product_colors;
create policy "product_colors_public_read" on public.product_colors
for select using (
  public.is_admin()
  or exists (select 1 from public.products p where p.id = product_id and p.is_active = true)
);

drop policy if exists "product_colors_admin_write" on public.product_colors;
create policy "product_colors_admin_write" on public.product_colors
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "product_reviews_public_read" on public.product_reviews;
create policy "product_reviews_public_read" on public.product_reviews
for select using (
  public.is_admin()
  or (
    is_approved = true
    and exists (select 1 from public.products p where p.id = product_id and p.is_active = true)
  )
);

drop policy if exists "product_reviews_admin_write" on public.product_reviews;
create policy "product_reviews_admin_write" on public.product_reviews
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "contact_messages_public_insert" on public.contact_messages;
create policy "contact_messages_public_insert" on public.contact_messages
for insert with check (
  name is not null
  and length(trim(name)) > 0
  and email is not null
  and length(trim(email)) > 0
  and message is not null
  and length(trim(message)) > 0
  and (
    (auth.uid() is null and user_id is null)
    or (auth.uid() = user_id)
  )
);

drop policy if exists "contact_messages_admin_all" on public.contact_messages;
create policy "contact_messages_admin_all" on public.contact_messages
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "promo_codes_admin_all" on public.promo_codes;
create policy "promo_codes_admin_all" on public.promo_codes
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "orders_public_insert" on public.orders;
create policy "orders_public_insert" on public.orders
for insert with check (
  visitor_id is not null
  and length(visitor_id) > 0
  and (
    (auth.uid() is null and user_id is null)
    or (auth.uid() = user_id)
  )
);

drop policy if exists "orders_admin_read_update" on public.orders;
create policy "orders_admin_read_update" on public.orders
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order_items_public_insert" on public.order_items;
create policy "order_items_public_insert" on public.order_items
for insert with check (true);

drop policy if exists "order_items_admin_read_update" on public.order_items;
create policy "order_items_admin_read_update" on public.order_items
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "page_views_public_insert" on public.page_views;
create policy "page_views_public_insert" on public.page_views
for insert with check (true);

drop policy if exists "page_views_admin_read" on public.page_views;
create policy "page_views_admin_read" on public.page_views
for select using (public.is_admin());

drop policy if exists "analytics_visits_public_insert" on public.analytics_visits;
create policy "analytics_visits_public_insert" on public.analytics_visits
for insert with check (
  visitor_id is not null
  and length(visitor_id) > 0
  and page_path is not null
  and page_path not like '/admin%'
  and (
    (auth.uid() is null and user_id is null)
    or (auth.uid() = user_id)
  )
);

drop policy if exists "analytics_visits_admin_read" on public.analytics_visits;
create policy "analytics_visits_admin_read" on public.analytics_visits
for select using (public.is_admin());

drop policy if exists "cart_events_public_insert" on public.cart_events;
create policy "cart_events_public_insert" on public.cart_events
for insert with check (
  visitor_id is not null
  and length(visitor_id) > 0
  and quantity > 0
  and (
    (auth.uid() is null and user_id is null)
    or (auth.uid() = user_id)
  )
);

drop policy if exists "cart_events_admin_read" on public.cart_events;
create policy "cart_events_admin_read" on public.cart_events
for select using (public.is_admin());

-- Create these buckets in Storage if they do not exist:
-- product-images: public
-- product-instagram: public (home page Instagram slider)
-- payment-receipts: private
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-instagram',
  'product-instagram',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
for select using (bucket_id = 'product-images');

drop policy if exists "product_instagram_public_read" on storage.objects;
create policy "product_instagram_public_read" on storage.objects
for select using (bucket_id = 'product-instagram');

drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert" on storage.objects
for insert with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  )
);

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update" on storage.objects
for update using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  )
)
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  )
);

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete" on storage.objects
for delete using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  )
);

drop policy if exists "product_instagram_admin_insert" on storage.objects;
create policy "product_instagram_admin_insert" on storage.objects
for insert with check (
  bucket_id = 'product-instagram'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  )
);

drop policy if exists "product_instagram_admin_update" on storage.objects;
create policy "product_instagram_admin_update" on storage.objects
for update using (
  bucket_id = 'product-instagram'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  )
)
with check (
  bucket_id = 'product-instagram'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  )
);

drop policy if exists "product_instagram_admin_delete" on storage.objects;
create policy "product_instagram_admin_delete" on storage.objects
for delete using (
  bucket_id = 'product-instagram'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  )
);

drop policy if exists "payment_receipts_public_insert" on storage.objects;
create policy "payment_receipts_public_insert" on storage.objects
for insert with check (bucket_id = 'payment-receipts');

drop policy if exists "payment_receipts_admin_read" on storage.objects;
create policy "payment_receipts_admin_read" on storage.objects
for select using (
  bucket_id = 'payment-receipts'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  )
);

insert into public.profiles (id, email, role, status, created_at, updated_at)
select id, email, 'customer', 'active', now(), now()
from auth.users
on conflict (id) do nothing;

-- Optional: enable realtime for key tables (required for the app's live updates).
do $$
begin
  alter publication supabase_realtime add table public.products;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.product_images;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.product_variants;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.product_colors;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.product_reviews;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.contact_messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.order_items;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.analytics_visits;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.cart_events;
exception when duplicate_object then null;
end $$;
