create table if not exists public.users (
  uid uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone_number text not null,
  role text not null check (role in ('customer', 'seller', 'admin')),
  account_status text not null check (account_status in ('active', 'pending', 'suspended', 'rejected')),
  seller_status text check (seller_status in ('pending', 'approved', 'rejected')),
  shop_name text,
  business_description text,
  village text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  terms_accepted_at timestamptz not null default now(),
  check (
    (role = 'seller' and seller_status is not null and shop_name is not null and business_description is not null and village is not null)
    or (role <> 'seller' and seller_status is null)
  )
);

create table if not exists public.sellers (
  id uuid primary key references public.users(uid) on delete cascade,
  name text not null,
  place text not null,
  image text not null default '/assets/seller-firewood.png',
  sales integer not null default 0,
  active boolean not null default true
);

create table if not exists public.products (
  id text primary key,
  seller_id uuid not null references public.users(uid),
  seller text not null,
  name text not null,
  detail text not null default '',
  place text not null default '',
  price numeric(12, 2) not null check (price >= 0),
  stock integer not null check (stock >= 0),
  unit text not null,
  category text not null,
  image text not null default ''
);

create table if not exists public.seller_application_products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users(uid) on delete cascade,
  name text not null,
  detail text not null,
  price numeric(12, 2) not null check (price > 0),
  stock integer not null check (stock > 0),
  unit text not null,
  category text not null,
  image text not null
);

create table if not exists public.categories (
  id text primary key,
  name text not null unique
);

create table if not exists public.orders (
  id text primary key,
  buyer_id uuid not null references public.users(uid),
  buyer text not null,
  seller_id uuid not null references public.users(uid),
  seller text not null,
  items text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  delivery text not null check (delivery in ('Yard pickup', 'Gate delivery')),
  status text not null,
  paid boolean not null default false,
  buyer_received boolean,
  buyer_paid boolean,
  product_lines jsonb not null check (jsonb_typeof(product_lines) = 'array'),
  created_at bigint not null
);

create or replace function public.is_marketplace_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.users
    where uid = auth.uid()
      and role = 'admin'
      and account_status = 'active'
  );
$$;

create or replace function public.is_approved_seller()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.users
    where uid = auth.uid()
      and role = 'seller'
      and account_status = 'active'
      and seller_status = 'approved'
  );
$$;

create or replace function public.create_marketplace_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  metadata jsonb := new.raw_user_meta_data;
  profile_role text := case when metadata ->> 'role' = 'seller' then 'seller' else 'customer' end;
  inserted_products integer;
begin
  if profile_role = 'seller' and (
    jsonb_typeof(metadata -> 'application_products') is distinct from 'array'
    or jsonb_array_length(metadata -> 'application_products') not between 1 and 3
  ) then
    raise exception 'Seller applications must include between one and three products.';
  end if;

  insert into public.users (
    uid, first_name, last_name, email, phone_number, role, account_status,
    seller_status, shop_name, business_description, village
  )
  values (
    new.id,
    coalesce(metadata ->> 'first_name', ''),
    coalesce(metadata ->> 'last_name', ''),
    coalesce(new.email, ''),
    coalesce(metadata ->> 'phone_number', ''),
    profile_role,
    case when profile_role = 'seller' then 'pending' else 'active' end,
    case when profile_role = 'seller' then 'pending' else null end,
    case when profile_role = 'seller' then coalesce(metadata ->> 'shop_name', '') else null end,
    case when profile_role = 'seller' then coalesce(metadata ->> 'business_description', '') else null end,
    case when profile_role = 'seller' then coalesce(metadata ->> 'village', '') else null end
  )
  on conflict (uid) do nothing;

  if profile_role = 'seller' then
    insert into public.seller_application_products (
      seller_id, name, detail, price, stock, unit, category, image
    )
    select
      new.id,
      product ->> 'name',
      product ->> 'detail',
      (product ->> 'price')::numeric,
      (product ->> 'stock')::integer,
      product ->> 'unit',
      product ->> 'category',
      product ->> 'image'
    from jsonb_array_elements(metadata -> 'application_products') as product
    where jsonb_typeof(product) = 'object'
      and coalesce(product ->> 'name', '') <> ''
      and coalesce(product ->> 'detail', '') <> ''
      and coalesce(product ->> 'unit', '') <> ''
      and coalesce(product ->> 'category', '') <> ''
      and coalesce(product ->> 'image', '') <> '';
    get diagnostics inserted_products = row_count;
    if inserted_products <> jsonb_array_length(metadata -> 'application_products') then
      raise exception 'Every submitted product must include valid details and a product photo.';
    end if;

    update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'application_products'
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists create_marketplace_profile_after_signup on auth.users;
create trigger create_marketplace_profile_after_signup
after insert on auth.users
for each row execute function public.create_marketplace_profile();

alter table public.users enable row level security;
alter table public.sellers enable row level security;
alter table public.products enable row level security;
alter table public.seller_application_products enable row level security;
alter table public.categories enable row level security;
alter table public.orders enable row level security;

drop policy if exists "users can read own profile or admin can read all" on public.users;
create policy "users can read own profile or admin can read all"
on public.users for select to authenticated
using (uid = auth.uid() or public.is_marketplace_admin());

drop policy if exists "users can create own customer or seller profile" on public.users;
drop policy if exists "users can create own customer profile" on public.users;
create policy "users can create own customer profile"
on public.users for insert to authenticated
with check (
  uid = auth.uid()
  and role = 'customer'
  and account_status = 'active'
  and seller_status is null
  and email = (select email from auth.users where id = auth.uid())
);

drop policy if exists "users can update own contact details" on public.users;
create policy "users can update own contact details"
on public.users for update to authenticated
using (uid = auth.uid() or public.is_marketplace_admin())
with check (uid = auth.uid() or public.is_marketplace_admin());

drop policy if exists "anyone can read sellers" on public.sellers;
create policy "anyone can read sellers"
on public.sellers for select to anon, authenticated using (true);

drop policy if exists "admins manage sellers" on public.sellers;
create policy "admins manage sellers"
on public.sellers for all to authenticated
using (public.is_marketplace_admin())
with check (public.is_marketplace_admin());

drop policy if exists "admins can review seller product submissions" on public.seller_application_products;
create policy "admins can review seller product submissions"
on public.seller_application_products for select to authenticated
using (public.is_marketplace_admin());

create or replace function public.complete_seller_application(p_profile jsonb, p_products jsonb)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  inserted_profile integer;
  inserted_products integer;
begin
  if auth.uid() is null
    or p_profile ->> 'uid' is distinct from auth.uid()::text
    or p_profile ->> 'role' is distinct from 'seller'
    or p_profile ->> 'email' is distinct from (select email from auth.users where id = auth.uid())
    or jsonb_typeof(p_products) is distinct from 'array'
    or jsonb_array_length(p_products) not between 1 and 3 then
    raise exception 'The seller application details are invalid.';
  end if;

  insert into public.users (
    uid, first_name, last_name, email, phone_number, role, account_status,
    seller_status, shop_name, business_description, village
  )
  values (
    auth.uid(),
    coalesce(p_profile ->> 'first_name', ''),
    coalesce(p_profile ->> 'last_name', ''),
    p_profile ->> 'email',
    coalesce(p_profile ->> 'phone_number', ''),
    'seller',
    'pending',
    'pending',
    coalesce(p_profile ->> 'shop_name', ''),
    coalesce(p_profile ->> 'business_description', ''),
    coalesce(p_profile ->> 'village', '')
  )
  on conflict (uid) do nothing;
  get diagnostics inserted_profile = row_count;
  if inserted_profile = 0 then
    raise exception 'Your account profile already exists. Please sign in.';
  end if;

  insert into public.seller_application_products (
    seller_id, name, detail, price, stock, unit, category, image
  )
  select
    auth.uid(),
    product ->> 'name',
    product ->> 'detail',
    (product ->> 'price')::numeric,
    (product ->> 'stock')::integer,
    product ->> 'unit',
    product ->> 'category',
    product ->> 'image'
  from jsonb_array_elements(p_products) as product
  where jsonb_typeof(product) = 'object'
    and coalesce(product ->> 'name', '') <> ''
    and coalesce(product ->> 'detail', '') <> ''
    and coalesce(product ->> 'unit', '') <> ''
    and coalesce(product ->> 'category', '') <> ''
    and coalesce(product ->> 'image', '') <> '';
  get diagnostics inserted_products = row_count;
  if inserted_products <> jsonb_array_length(p_products) then
    raise exception 'Every submitted product must include valid details and a product photo.';
  end if;
end;
$$;

drop policy if exists "anyone can read products" on public.products;
create policy "anyone can read products"
on public.products for select to anon, authenticated using (true);

drop policy if exists "approved sellers and admins manage products" on public.products;
create policy "approved sellers and admins manage products"
on public.products for all to authenticated
using (public.is_marketplace_admin() or (seller_id = auth.uid() and public.is_approved_seller()))
with check (public.is_marketplace_admin() or (seller_id = auth.uid() and public.is_approved_seller()));

drop policy if exists "anyone can read categories" on public.categories;
create policy "anyone can read categories"
on public.categories for select to anon, authenticated using (true);

drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories"
on public.categories for all to authenticated
using (public.is_marketplace_admin())
with check (public.is_marketplace_admin());

drop policy if exists "order parties and admins can read orders" on public.orders;
create policy "order parties and admins can read orders"
on public.orders for select to authenticated
using (
  public.is_marketplace_admin()
  or buyer_id = auth.uid()
  or (seller_id = auth.uid() and public.is_approved_seller())
);

drop policy if exists "order parties and admins can update orders" on public.orders;
create policy "order parties and admins can update orders"
on public.orders for update to authenticated
using (
  public.is_marketplace_admin()
  or buyer_id = auth.uid()
  or (seller_id = auth.uid() and public.is_approved_seller())
)
with check (
  public.is_marketplace_admin()
  or buyer_id = auth.uid()
  or (seller_id = auth.uid() and public.is_approved_seller())
);

create or replace function public.protect_order_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if public.is_marketplace_admin() then
    return new;
  end if;

  if old.buyer_id = auth.uid() then
    if old.status not in ('Ready for pickup', 'Out for delivery', 'Completed')
      or new.buyer_received is distinct from true
      or new.buyer_paid is null
      or (to_jsonb(new) - array['buyer_received', 'buyer_paid'])
        is distinct from (to_jsonb(old) - array['buyer_received', 'buyer_paid']) then
      raise exception 'Customers can only confirm receipt and cash payment on an eligible order.';
    end if;
    return new;
  end if;

  if old.seller_id = auth.uid() and public.is_approved_seller() then
    if (to_jsonb(new) - array['paid', 'status'])
      is distinct from (to_jsonb(old) - array['paid', 'status'])
      or (new.status is distinct from old.status and new.status not in (
        'Seller confirmed', 'Ready for pickup', 'Out for delivery', 'Completed'
      ))
      or (new.status = 'Completed' and (
        new.paid is distinct from true
        or old.buyer_received is distinct from true
        or old.buyer_paid is distinct from true
      )) then
      raise exception 'Sellers can only update order progress and cash payment status.';
    end if;
    return new;
  end if;

  raise exception 'You cannot update this order.';
end;
$$;

drop trigger if exists protect_order_update_before_write on public.orders;
create trigger protect_order_update_before_write
before update on public.orders
for each row execute function public.protect_order_update();

create or replace function public.review_seller_application(p_uid uuid, p_approved boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  application public.users%rowtype;
begin
  if not public.is_marketplace_admin() then
    raise exception 'Only an administrator can review seller applications.';
  end if;
  select * into application from public.users where uid = p_uid for update;
  if not found or application.role <> 'seller' or application.seller_status <> 'pending' then
    raise exception 'This seller application is no longer pending.';
  end if;
  update public.users
  set seller_status = case when p_approved then 'approved' else 'rejected' end,
      account_status = case when p_approved then 'active' else 'rejected' end,
      updated_at = now()
  where uid = p_uid;

  if p_approved then
    if not exists (
      select 1 from public.seller_application_products where seller_id = p_uid
    ) then
      raise exception 'This seller application has no submitted products.';
    end if;
    insert into public.sellers (id, name, place, image, sales, active)
    values (p_uid, application.shop_name, application.village, '/assets/seller-firewood.png', 0, true)
    on conflict (id) do update
      set name = excluded.name, place = excluded.place, active = true;
    insert into public.products (
      id, seller_id, seller, name, detail, place, price, stock, unit, category, image
    )
    select
      gen_random_uuid()::text,
      p_uid,
      application.shop_name,
      submitted.name,
      submitted.detail,
      application.village,
      submitted.price,
      submitted.stock,
      submitted.unit,
      submitted.category,
      submitted.image
    from public.seller_application_products as submitted
    where submitted.seller_id = p_uid;
    delete from public.seller_application_products where seller_id = p_uid;
  else
    delete from public.sellers where id = p_uid;
    delete from public.seller_application_products where seller_id = p_uid;
  end if;
end;
$$;

create or replace function public.set_account_suspended(p_uid uuid, p_suspended boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  account public.users%rowtype;
begin
  if not public.is_marketplace_admin() then
    raise exception 'Only an administrator can suspend accounts.';
  end if;
  select * into account from public.users where uid = p_uid for update;
  if not found or account.role = 'admin' then
    raise exception 'This account cannot be changed here.';
  end if;

  update public.users
  set account_status = case
        when p_suspended then 'suspended'
        when account.role = 'seller' and account.seller_status = 'approved' then 'active'
        when account.role = 'seller' and account.seller_status = 'rejected' then 'rejected'
        when account.role = 'seller' then 'pending'
        else 'active'
      end,
      updated_at = now()
  where uid = p_uid;

  if account.role = 'seller' and account.seller_status = 'approved' then
    update public.sellers set active = not p_suspended where id = p_uid;
  end if;
end;
$$;

create or replace function public.remove_seller_records(p_seller_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_marketplace_admin() then
    raise exception 'Only an administrator can remove sellers.';
  end if;
  delete from public.products where seller_id = p_seller_id;
  delete from public.sellers where id = p_seller_id;
end;
$$;

create or replace function public.place_order(p_order jsonb, p_product_updates jsonb)
returns setof public.products
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  update_row jsonb;
  current_product public.products%rowtype;
  updated_product public.products%rowtype;
  order_seller uuid;
  quantity integer;
  total numeric(12, 2) := 0;
  seen_ids text[] := array[]::text[];
  item_text text[] := array[]::text[];
  user_role text;
  user_status text;
  delivery text;
begin
  select role, account_status into user_role, user_status
  from public.users where uid = auth.uid();
  if auth.uid() is null or user_role <> 'customer' or user_status <> 'active' then
    raise exception 'An active customer account is required to place an order.';
  end if;
  if jsonb_typeof(p_order) <> 'object'
    or jsonb_typeof(p_product_updates) <> 'array'
    or jsonb_array_length(p_product_updates) = 0
    or p_order ->> 'buyer_id' <> auth.uid()::text
    or p_order ->> 'status' <> 'Order placed'
    or coalesce((p_order ->> 'paid')::boolean, true) <> false
    or p_order -> 'product_lines' is distinct from p_product_updates then
    raise exception 'The order details are invalid.';
  end if;

  delivery := p_order ->> 'delivery';
  if delivery not in ('Yard pickup', 'Gate delivery') then
    raise exception 'The selected delivery method is invalid.';
  end if;

  for update_row in select value from jsonb_array_elements(p_product_updates)
  loop
    if jsonb_typeof(update_row) <> 'object'
      or coalesce(update_row ->> 'product_id', '') = ''
      or coalesce((update_row ->> 'quantity')::integer, 0) <= 0 then
      raise exception 'Order quantities must be positive whole numbers.';
    end if;
    if (update_row ->> 'product_id') = any(seen_ids) then
      raise exception 'The order contains duplicate product rows.';
    end if;
    seen_ids := array_append(seen_ids, update_row ->> 'product_id');
    quantity := (update_row ->> 'quantity')::integer;

    select * into current_product
    from public.products
    where id = update_row ->> 'product_id'
    for update;
    if not found then
      raise exception 'A product in your basket is no longer available.';
    end if;
    if current_product.stock < quantity then
      raise exception '% only has % left in stock.', current_product.name, current_product.stock;
    end if;
    if order_seller is null then
      order_seller := current_product.seller_id;
    elsif order_seller <> current_product.seller_id then
      raise exception 'Please place one seller''s order at a time.';
    end if;
    if not exists (
      select 1 from public.sellers
      where id = current_product.seller_id and active = true
    ) then
      raise exception 'This seller is not currently accepting orders.';
    end if;

    total := round(total + current_product.price * quantity, 2);
    item_text := array_append(item_text, quantity::text || '× ' || current_product.name);
    update public.products
    set stock = stock - quantity
    where id = current_product.id
    returning * into updated_product;
    return next updated_product;
  end loop;

  if order_seller is null or p_order ->> 'seller_id' <> order_seller::text then
    raise exception 'The seller on this order does not match the basket.';
  end if;
  if delivery = 'Gate delivery' then
    total := round(total + 15, 2);
  end if;
  if round((p_order ->> 'amount')::numeric, 2) <> total then
    raise exception 'The order total changed. Refresh the basket and try again.';
  end if;
  if coalesce(p_order ->> 'id', '') = '' then
    raise exception 'The order ID is missing.';
  end if;

  insert into public.orders (
    id, buyer_id, buyer, seller_id, seller, items, amount, delivery,
    status, paid, product_lines, created_at
  )
  select
    p_order ->> 'id',
    auth.uid(),
    'You',
    order_seller,
    (select name from public.sellers where id = order_seller),
    array_to_string(item_text, ', '),
    total,
    delivery,
    'Order placed',
    false,
    p_product_updates,
    (p_order ->> 'created_at')::bigint;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.sellers, public.products, public.categories to anon, authenticated;
grant select on public.seller_application_products to authenticated;
grant select, insert, update on public.users to authenticated;
revoke update on public.users from authenticated;
grant update (first_name, last_name, phone_number, updated_at) on public.users to authenticated;
grant insert, update, delete on public.sellers, public.products, public.categories to authenticated;
grant select, update on public.orders to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['users', 'sellers', 'products', 'seller_application_products', 'categories', 'orders']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

grant execute on function public.review_seller_application(uuid, boolean) to authenticated;
grant execute on function public.complete_seller_application(jsonb, jsonb) to authenticated;
grant execute on function public.set_account_suspended(uuid, boolean) to authenticated;
grant execute on function public.remove_seller_records(uuid) to authenticated;
grant execute on function public.place_order(jsonb, jsonb) to authenticated;
