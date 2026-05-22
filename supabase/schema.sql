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

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default ('ORD-' || upper(substr(gen_random_uuid()::text, 1, 8))),
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

create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  source text not null default 'Direct',
  referrer text,
  visitor_id text,
  user_agent text,
  created_at timestamptz not null default now()
);

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
begin
  insert into public.orders (
    customer_name, email, phone, address, city, notes,
    shipping_fee, subtotal, total, payment_method, payment_status, receipt_url
  )
  values (
    order_payload->>'customer_name',
    order_payload->>'email',
    order_payload->>'phone',
    order_payload->>'address',
    order_payload->>'city',
    order_payload->>'notes',
    coalesce((order_payload->>'shipping_fee')::numeric, 0),
    coalesce((order_payload->>'subtotal')::numeric, 0),
    coalesce((order_payload->>'total')::numeric, 0),
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
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.page_views enable row level security;

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

drop policy if exists "orders_public_insert" on public.orders;
create policy "orders_public_insert" on public.orders
for insert with check (true);

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

-- Create these buckets in Storage if they do not exist:
-- product-images: public
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
