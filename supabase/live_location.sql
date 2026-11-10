-- Position du chauffeur en direct, envoyée par son téléphone pendant la course.
alter table safemobility.reservations
  add column if not exists driver_lat double precision,
  add column if not exists driver_lng double precision,
  add column if not exists driver_heading int,
  add column if not exists driver_seen_at timestamptz;

create or replace function safemobility._trip_json(r safemobility.reservations) returns jsonb
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
    'driverLocation', case when r.driver_seen_at is null or r.status not in ('on_the_way', 'arrived', 'in_progress') then null
      else jsonb_build_object('lat', r.driver_lat, 'lng', r.driver_lng, 'heading', coalesce(r.driver_heading, 0), 'at', r.driver_seen_at) end,
    'driver', (select safemobility._driver_public(d) from safemobility.drivers d where d.id = r.driver_id)
  )
$$;

create or replace function safemobility.driver_location(p_id uuid, p_lat double precision, p_lng double precision, p_heading int default 0) returns void
language plpgsql security definer set search_path = safemobility, public as $$
begin
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'bad_position' using hint = 'Invalid position.';
  end if;
  update reservations set driver_lat = p_lat, driver_lng = p_lng, driver_heading = coalesce(p_heading, 0) % 360, driver_seen_at = now()
  where id = p_id and driver_id = _uid() and status in ('on_the_way', 'arrived', 'in_progress');
end $$;

revoke execute on function safemobility.driver_location(uuid, double precision, double precision, int) from public, anon;
grant execute on function safemobility.driver_location(uuid, double precision, double precision, int) to authenticated;
