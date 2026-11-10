-- À appliquer ensuite : live_location.sql (position du chauffeur en direct).
-- SafeMobility : réservations à l'avance, abonnements trajet domicile-travail, chauffeurs.
-- Rangé dans son propre schéma « safemobility » (projet Supabase partagé avec StatesMob).
-- Aucun accès direct aux tables : tout passe par les fonctions ci-dessous, qui vérifient auth.uid().
-- Rejouable : on repart de zéro à chaque exécution.

drop schema if exists safemobility cascade;
create schema safemobility;
grant usage on schema safemobility to authenticated;

create table safemobility.drivers (
  id uuid primary key default auth.uid(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text not null,
  city text not null,
  vehicle jsonb not null,          -- {type, year, make, model, color, seats, plate}
  classes text[] not null,         -- sedan / suv / premium : ce que la voiture peut faire
  license_number text not null,
  insurance_info text not null,
  days text[] not null,
  availability_notes text not null default '',
  ride_pref text not null check (ride_pref in ('private_only', 'private_and_shared')),
  verified_at timestamptz not null default now() + interval '45 seconds', -- démo : validation automatique
  rating numeric(3, 2) not null default 5,
  ratings_count int not null default 0,
  created_at timestamptz not null default now()
);

create table safemobility.reservations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default 'SM-' || upper(substr(md5(random()::text), 1, 5)),
  passenger_id uuid not null default auth.uid(),
  full_name text not null,
  phone text not null,
  email text not null,
  pickup jsonb not null,           -- {id, name, detail, point:{lat,lng}}
  destination jsonb not null,
  pickup_at timestamptz not null,
  passengers int not null check (passengers between 1 and 7),
  trip_type text not null,
  vehicle text not null check (vehicle in ('sedan', 'suv', 'premium')),
  payment text not null check (payment in ('cash', 'card')),
  notes text not null default '',
  distance_m int not null,
  duration_s int not null,
  price_cents int not null check (price_cents > 0),
  fixed_rate boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'on_the_way', 'arrived', 'in_progress', 'completed', 'cancelled')),
  driver_id uuid references safemobility.drivers (id),
  eta_minutes int,
  confirmed_at timestamptz,
  on_the_way_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text,
  stars int check (stars between 1 and 5),
  created_at timestamptz not null default now()
);
create index on safemobility.reservations (passenger_id);
create index on safemobility.reservations (phone);
create index on safemobility.reservations (status, pickup_at);
create index on safemobility.reservations (driver_id);

create table safemobility.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default 'WK-' || upper(substr(md5(random()::text), 1, 5)),
  passenger_id uuid not null default auth.uid(),
  full_name text not null,
  phone text not null,
  email text not null,
  home jsonb not null,
  work jsonb not null,
  morning_time text not null,      -- « 07:30 »
  evening_time text not null,
  days text[] not null,
  passengers int not null check (passengers between 1 and 7),
  notes text not null default '',
  distance_m int not null,
  price_per_week_cents int not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'cancelled')),
  quote_ready_at timestamptz not null default now() + interval '20 seconds', -- démo : le dispatch répond vite
  activated_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index on safemobility.weekly_plans (passenger_id);

alter table safemobility.drivers enable row level security;
alter table safemobility.reservations enable row level security;
alter table safemobility.weekly_plans enable row level security;

-- ─────────────────────────── aides ───────────────────────────

create function safemobility._uid() returns uuid language plpgsql as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using hint = 'Could not connect to SafeMobility. Try again.';
  end if;
  return auth.uid();
end $$;

create function safemobility._verified(d safemobility.drivers) returns boolean language sql stable as $$
  select d.verified_at <= now()
$$;

create function safemobility._driver_public(d safemobility.drivers) returns jsonb language sql stable as $$
  select case when d.id is null then null else jsonb_build_object(
    'id', d.id, 'firstName', d.first_name, 'lastName', d.last_name, 'phone', d.phone,
    'rating', d.rating, 'ratingsCount', d.ratings_count, 'vehicle', d.vehicle
  ) end
$$;

create function safemobility._trip_json(r safemobility.reservations) returns jsonb
language sql stable security definer set search_path = safemobility, public as $$
  select jsonb_build_object(
    'id', r.id, 'code', r.code, 'fullName', r.full_name, 'phone', r.phone, 'email', r.email,
    'pickup', r.pickup, 'destination', r.destination, 'pickupAt', r.pickup_at,
    'passengers', r.passengers, 'tripType', r.trip_type, 'vehicle', r.vehicle, 'payment', r.payment, 'notes', r.notes,
    'distanceM', r.distance_m, 'durationS', r.duration_s, 'priceCents', r.price_cents, 'fixedRate', r.fixed_rate,
    'status', r.status, 'etaMinutes', r.eta_minutes,
    'confirmedAt', r.confirmed_at, 'onTheWayAt', r.on_the_way_at, 'arrivedAt', r.arrived_at,
    'startedAt', r.started_at, 'completedAt', r.completed_at, 'cancelledAt', r.cancelled_at, 'cancelledBy', r.cancelled_by,
    'stars', r.stars, 'createdAt', r.created_at,
    'driver', (select safemobility._driver_public(d) from safemobility.drivers d where d.id = r.driver_id)
  )
$$;

create function safemobility._plan_json(p safemobility.weekly_plans) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', p.id, 'code', p.code, 'fullName', p.full_name, 'phone', p.phone, 'email', p.email,
    'home', p.home, 'work', p.work, 'morningTime', p.morning_time, 'eveningTime', p.evening_time,
    'days', to_jsonb(p.days), 'passengers', p.passengers, 'notes', p.notes, 'distanceM', p.distance_m,
    'pricePerWeekCents', case when p.status <> 'pending' or p.quote_ready_at <= now() then p.price_per_week_cents end,
    'status', case when p.status = 'pending' and p.quote_ready_at <= now() then 'quoted' else p.status end,
    'quoteReadyAt', p.quote_ready_at, 'activatedAt', p.activated_at, 'cancelledAt', p.cancelled_at, 'createdAt', p.created_at
  )
$$;

create function safemobility._driver_json(d safemobility.drivers) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', d.id, 'firstName', d.first_name, 'lastName', d.last_name, 'phone', d.phone, 'email', d.email, 'city', d.city,
    'vehicle', d.vehicle, 'classes', to_jsonb(d.classes), 'days', to_jsonb(d.days), 'ridePref', d.ride_pref,
    'rating', d.rating, 'ratingsCount', d.ratings_count,
    'verifiedAt', d.verified_at, 'verified', d.verified_at <= now()
  )
$$;

create function safemobility._check_contact(p jsonb) returns void language plpgsql as $$
begin
  if coalesce(trim(p->>'fullName'), '') = '' then
    raise exception 'name_required' using hint = 'Add your full name.';
  end if;
  if coalesce(p->>'phone', '') !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$' then
    raise exception 'invalid_phone' using hint = 'Enter a 10-digit US phone number.';
  end if;
  if coalesce(p->>'email', '') !~ '^\S+@\S+\.\S+$' then
    raise exception 'invalid_email' using hint = 'Enter a valid email address.';
  end if;
end $$;

-- ─────────────────────────── passager : réservations ───────────────────────────

create function safemobility.book(p jsonb) returns jsonb
language plpgsql security definer set search_path = safemobility, public as $$
declare
  me uuid := _uid();
  r reservations;
  v_at timestamptz := (p->>'pickupAt')::timestamptz;
  pax int := (p->>'passengers')::int;
  seats int := case p->>'vehicle' when 'sedan' then 4 when 'suv' then 5 when 'premium' then 7 end;
begin
  perform _check_contact(p);
  if p->'pickup'->'point' is null or p->'destination'->'point' is null then
    raise exception 'places_required' using hint = 'Choose a pickup and a destination.';
  end if;
  if v_at < now() + interval '15 minutes' then
    raise exception 'too_soon' using hint = 'Pick a time at least 15 minutes from now, or call dispatch for an immediate ride.';
  end if;
  if v_at > now() + interval '60 days' then
    raise exception 'too_far' using hint = 'You can book up to 60 days ahead.';
  end if;
  if seats is null then
    raise exception 'invalid_vehicle' using hint = 'Choose a vehicle.';
  end if;
  if pax is null or pax < 1 or pax > seats then
    raise exception 'too_many' using hint = format('This vehicle seats up to %s passengers.', seats);
  end if;
  if (select count(*) from reservations where passenger_id = me and status not in ('completed', 'cancelled')) >= 5 then
    raise exception 'too_many_trips' using hint = 'You already have 5 upcoming trips. Cancel one or call dispatch.';
  end if;
  insert into reservations (full_name, phone, email, pickup, destination, pickup_at, passengers, trip_type, vehicle, payment, notes,
                            distance_m, duration_s, price_cents, fixed_rate)
  values (trim(p->>'fullName'), p->>'phone', trim(p->>'email'), p->'pickup', p->'destination', v_at, pax,
          coalesce(p->>'tripType', 'Local Ride'), p->>'vehicle', coalesce(p->>'payment', 'cash'), left(coalesce(p->>'notes', ''), 500),
          (p->>'distanceM')::int, (p->>'durationS')::int, (p->>'priceCents')::int, coalesce((p->>'fixedRate')::boolean, false))
  returning * into r;
  return _trip_json(r);
end $$;

create function safemobility.get_trip(p_id uuid) returns jsonb
language plpgsql security definer set search_path = safemobility, public as $$
declare me uuid := _uid(); r reservations;
begin
  select * into r from reservations where id = p_id and (passenger_id = me or driver_id = me);
  if not found then
    -- un chauffeur validé peut voir une demande encore libre
    select * into r from reservations where id = p_id and status = 'pending'
      and exists (select 1 from drivers d where d.id = me and d.verified_at <= now());
  end if;
  if not found then
    raise exception 'not_found' using hint = 'We could not find this trip.';
  end if;
  return _trip_json(r);
end $$;

create function safemobility.my_trips() returns jsonb
language sql security definer set search_path = safemobility, public as $$
  select coalesce(jsonb_agg(_trip_json(r) order by r.pickup_at desc), '[]')
  from reservations r where r.passenger_id = auth.uid()
$$;

create function safemobility.cancel_trip(p_id uuid) returns jsonb
language plpgsql security definer set search_path = safemobility, public as $$
declare me uuid := _uid(); r reservations;
begin
  update reservations set status = 'cancelled', cancelled_at = now(), cancelled_by = 'passenger'
  where id = p_id and passenger_id = me and status in ('pending', 'confirmed', 'on_the_way')
  returning * into r;
  if not found then
    raise exception 'not_cancellable' using hint = 'This trip can no longer be cancelled. Call dispatch if you need help.';
  end if;
  return _trip_json(r);
end $$;

create function safemobility.rate_trip(p_id uuid, p_stars int) returns jsonb
language plpgsql security definer set search_path = safemobility, public as $$
declare me uuid := _uid(); r reservations;
begin
  if p_stars not between 1 and 5 then
    raise exception 'invalid_stars' using hint = 'Pick 1 to 5 stars.';
  end if;
  update reservations set stars = p_stars
  where id = p_id and passenger_id = me and status = 'completed' and stars is null
  returning * into r;
  if not found then
    raise exception 'not_ratable' using hint = 'This trip was already rated.';
  end if;
  update drivers set rating = round((rating * ratings_count + p_stars) / (ratings_count + 1), 2), ratings_count = ratings_count + 1
  where id = r.driver_id;
  return _trip_json(r);
end $$;

-- Suivi par numéro de téléphone (comme la page « Track Your Ride » du site) : le prochain trajet, sinon le dernier.
create function safemobility.track(p_phone text) returns jsonb
language plpgsql security definer set search_path = safemobility, public as $$
declare r reservations; d drivers;
begin
  perform _uid();
  select * into r from reservations where phone = p_phone and status not in ('completed', 'cancelled')
    order by pickup_at asc limit 1;
  if not found then
    select * into r from reservations where phone = p_phone order by pickup_at desc limit 1;
  end if;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  select * into d from drivers where id = r.driver_id;
  return jsonb_build_object(
    'found', true, 'code', r.code, 'status', r.status, 'pickup', r.pickup->>'name', 'destination', r.destination->>'name',
    'pickupAt', r.pickup_at, 'tripType', r.trip_type, 'etaMinutes', r.eta_minutes, 'onTheWayAt', r.on_the_way_at,
    'driver', case when d.id is null then null else jsonb_build_object(
      'name', d.first_name || ' ' || left(d.last_name, 1) || '.', 'carColor', d.vehicle->>'color',
      'carMake', d.vehicle->>'make', 'carModel', d.vehicle->>'model', 'plate', d.vehicle->>'plate') end
  );
end $$;

-- ─────────────────────────── passager : abonnement semaine ───────────────────────────

create function safemobility.create_plan(p jsonb) returns jsonb
language plpgsql security definer set search_path = safemobility, public as $$
declare me uuid := _uid(); w weekly_plans; v_days text[];
begin
  perform _check_contact(p);
  if p->'home'->'point' is null or p->'work'->'point' is null then
    raise exception 'places_required' using hint = 'Add your home and work addresses.';
  end if;
  select array_agg(x) into v_days from jsonb_array_elements_text(p->'days') x;
  if coalesce(array_length(v_days, 1), 0) = 0 then
    raise exception 'days_required' using hint = 'Pick at least one day.';
  end if;
  if coalesce(p->>'morningTime', '') !~ '^\d{2}:\d{2}$' or coalesce(p->>'eveningTime', '') !~ '^\d{2}:\d{2}$' then
    raise exception 'times_required' using hint = 'Pick your morning and evening pickup times.';
  end if;
  if p->>'eveningTime' <= p->>'morningTime' then
    raise exception 'times_order' using hint = 'The evening pickup must be after the morning one.';
  end if;
  if exists (select 1 from weekly_plans where passenger_id = me and status in ('pending', 'active')) then
    raise exception 'one_plan' using hint = 'You already have a weekly plan. Cancel it first to request a new one.';
  end if;
  insert into weekly_plans (full_name, phone, email, home, work, morning_time, evening_time, days, passengers, notes, distance_m, price_per_week_cents)
  values (trim(p->>'fullName'), p->>'phone', trim(p->>'email'), p->'home', p->'work', p->>'morningTime', p->>'eveningTime', v_days,
          (p->>'passengers')::int, left(coalesce(p->>'notes', ''), 500), (p->>'distanceM')::int, (p->>'pricePerWeekCents')::int)
  returning * into w;
  return _plan_json(w);
end $$;

create function safemobility.my_plans() returns jsonb
language sql security definer set search_path = safemobility, public as $$
  select coalesce(jsonb_agg(_plan_json(w) order by w.created_at desc), '[]') from weekly_plans w where w.passenger_id = auth.uid()
$$;

create function safemobility.get_plan(p_id uuid) returns jsonb
language plpgsql security definer set search_path = safemobility, public as $$
declare w weekly_plans;
begin
  select * into w from weekly_plans where id = p_id and passenger_id = _uid();
  if not found then
    raise exception 'not_found' using hint = 'We could not find this plan.';
  end if;
  return _plan_json(w);
end $$;

create function safemobility.accept_plan(p_id uuid) returns jsonb
language plpgsql security definer set search_path = safemobility, public as $$
declare w weekly_plans;
begin
  update weekly_plans set status = 'active', activated_at = now()
  where id = p_id and passenger_id = _uid() and status = 'pending' and quote_ready_at <= now()
  returning * into w;
  if not found then
    raise exception 'not_ready' using hint = 'Your weekly rate is not ready yet.';
  end if;
  return _plan_json(w);
end $$;

create function safemobility.cancel_plan(p_id uuid) returns jsonb
language plpgsql security definer set search_path = safemobility, public as $$
declare w weekly_plans;
begin
  update weekly_plans set status = 'cancelled', cancelled_at = now()
  where id = p_id and passenger_id = _uid() and status in ('pending', 'active')
  returning * into w;
  if not found then
    raise exception 'not_cancellable' using hint = 'This plan is already cancelled.';
  end if;
  return _plan_json(w);
end $$;

-- ─────────────────────────── chauffeur ───────────────────────────

create function safemobility.driver_register(p jsonb) returns jsonb
language plpgsql security definer set search_path = safemobility, public as $$
declare me uuid := _uid(); d drivers;
begin
  insert into drivers (id, first_name, last_name, phone, email, city, vehicle, classes, license_number, insurance_info, days, availability_notes, ride_pref)
  values (me, p->>'firstName', p->>'lastName', p->>'phone', p->>'email', p->>'city', p->'vehicle',
          array(select jsonb_array_elements_text(p->'classes')), p->>'licenseNumber', p->>'insuranceInfo',
          array(select jsonb_array_elements_text(p->'days')), coalesce(p->>'availabilityNotes', ''), p->>'ridePref')
  on conflict (id) do update set
    first_name = excluded.first_name, last_name = excluded.last_name, phone = excluded.phone, email = excluded.email,
    city = excluded.city, vehicle = excluded.vehicle, classes = excluded.classes, license_number = excluded.license_number,
    insurance_info = excluded.insurance_info, days = excluded.days, availability_notes = excluded.availability_notes, ride_pref = excluded.ride_pref
  returning * into d;
  return _driver_json(d);
end $$;

create function safemobility.driver_me() returns jsonb
language sql security definer set search_path = safemobility, public as $$
  select _driver_json(d) from drivers d where d.id = auth.uid()
$$;

-- Tableau du chauffeur : demandes libres qu'il peut prendre, et ses courses à venir.
create function safemobility.driver_board() returns jsonb
language plpgsql security definer set search_path = safemobility, public as $$
declare me uuid := _uid(); d drivers;
begin
  select * into d from drivers where id = me;
  if not found then
    raise exception 'not_driver' using hint = 'Apply to drive first.';
  end if;
  return jsonb_build_object(
    'verified', d.verified_at <= now(),
    'open', case when d.verified_at > now() then '[]'::jsonb else (
      select coalesce(jsonb_agg(_trip_json(r) order by r.pickup_at), '[]') from reservations r
      where r.status = 'pending' and r.pickup_at > now() - interval '30 minutes'
        and r.vehicle = any (d.classes) and r.passengers <= (d.vehicle->>'seats')::int) end,
    'mine', (select coalesce(jsonb_agg(_trip_json(r) order by r.pickup_at), '[]') from reservations r
      where r.driver_id = me and r.status in ('confirmed', 'on_the_way', 'arrived', 'in_progress'))
  );
end $$;

create function safemobility.driver_accept(p_id uuid) returns jsonb
language plpgsql security definer set search_path = safemobility, public as $$
declare me uuid := _uid(); d drivers; r reservations;
begin
  select * into d from drivers where id = me;
  if not found or d.verified_at > now() then
    raise exception 'not_verified' using hint = 'Only verified drivers can confirm rides.';
  end if;
  select * into r from reservations where id = p_id for update;
  if not found or r.status <> 'pending' then
    raise exception 'taken' using hint = 'Another driver already confirmed this ride.';
  end if;
  if not (r.vehicle = any (d.classes)) or r.passengers > (d.vehicle->>'seats')::int then
    raise exception 'wrong_vehicle' using hint = 'Your vehicle does not fit this booking.';
  end if;
  if exists (select 1 from reservations x where x.driver_id = me and x.status in ('confirmed', 'on_the_way', 'arrived', 'in_progress')
             and abs(extract(epoch from x.pickup_at - r.pickup_at)) < 3600) then
    raise exception 'overlap' using hint = 'You already have a ride within an hour of this pickup.';
  end if;
  update reservations set status = 'confirmed', driver_id = me, confirmed_at = now() where id = p_id returning * into r;
  return _trip_json(r);
end $$;

-- Étapes de la course côté chauffeur. « on_the_way » donne l'heure d'arrivée (ETA) au passager.
create function safemobility.driver_step(p_id uuid, p_status text, p_eta int default null) returns jsonb
language plpgsql security definer set search_path = safemobility, public as $$
declare me uuid := _uid(); r reservations;
begin
  select * into r from reservations where id = p_id and driver_id = me for update;
  if not found then
    raise exception 'not_found' using hint = 'We could not find this ride.';
  end if;
  if (r.status, p_status) not in (('confirmed', 'on_the_way'), ('on_the_way', 'arrived'), ('arrived', 'in_progress'), ('in_progress', 'completed')) then
    raise exception 'bad_step' using hint = 'This step is no longer possible. Refresh the ride.';
  end if;
  if p_status = 'on_the_way' and (p_eta is null or p_eta not between 1 and 180) then
    raise exception 'eta_required' using hint = 'Tell the passenger when you will arrive.';
  end if;
  update reservations set
    status = p_status,
    eta_minutes = case when p_status = 'on_the_way' then p_eta else eta_minutes end,
    on_the_way_at = case when p_status = 'on_the_way' then now() else on_the_way_at end,
    arrived_at = case when p_status = 'arrived' then now() else arrived_at end,
    started_at = case when p_status = 'in_progress' then now() else started_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end
  where id = p_id returning * into r;
  return _trip_json(r);
end $$;

-- Le chauffeur se désiste avant de prendre le passager : la réservation repart vers les autres chauffeurs.
create function safemobility.driver_release(p_id uuid) returns jsonb
language plpgsql security definer set search_path = safemobility, public as $$
declare r reservations;
begin
  update reservations set status = 'pending', driver_id = null, confirmed_at = null, on_the_way_at = null, eta_minutes = null
  where id = p_id and driver_id = _uid() and status in ('confirmed', 'on_the_way')
  returning * into r;
  if not found then
    raise exception 'not_releasable' using hint = 'You can only give back a ride before the pickup.';
  end if;
  return _trip_json(r);
end $$;

create function safemobility.driver_trips() returns jsonb
language sql security definer set search_path = safemobility, public as $$
  select coalesce(jsonb_agg(_trip_json(r) order by r.pickup_at desc), '[]')
  from (select * from reservations where driver_id = auth.uid() order by pickup_at desc limit 100) r
$$;

-- ─────────────────────────── droits ───────────────────────────

revoke all on all tables in schema safemobility from public, anon, authenticated;
revoke execute on all functions in schema safemobility from public, anon;
grant execute on function
  safemobility.book(jsonb), safemobility.get_trip(uuid), safemobility.my_trips(), safemobility.cancel_trip(uuid),
  safemobility.rate_trip(uuid, int), safemobility.track(text),
  safemobility.create_plan(jsonb), safemobility.my_plans(), safemobility.get_plan(uuid), safemobility.accept_plan(uuid), safemobility.cancel_plan(uuid),
  safemobility.driver_register(jsonb), safemobility.driver_me(), safemobility.driver_board(), safemobility.driver_accept(uuid),
  safemobility.driver_step(uuid, text, int), safemobility.driver_release(uuid), safemobility.driver_trips()
to authenticated;
