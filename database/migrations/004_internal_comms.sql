-- ============================================================================
-- 004 — Internal communication: staff chat and per-user notifications.
--
-- IMPORTANT — this migration deliberately breaks the app's usual RLS shape.
-- Every other domain is scoped with `has_clinic_access(clinic_id)`, meaning any
-- active member of the clinic can read the row. That is wrong for internal
-- chat: a direct message between the receptionist and a doctor must not be
-- readable by every other member, and a notification belongs to exactly one
-- person. So conversations and messages are scoped to *participation*, and
-- notifications to `user_id = auth.uid()`.
--
-- Apply after 003_branding_and_integrations.sql.
-- ============================================================================

do $$ begin
  create type conversation_kind as enum ('direct', 'group');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type notification_kind as enum ('system', 'chat', 'queue', 'agenda', 'financial');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Conversations
--
-- `direct_key` is what stops two people from accumulating a pile of duplicate
-- one-to-one threads: it is the two profile ids sorted and joined, so
-- "open the DM with X" is an upsert rather than a search-then-maybe-create race.
-- ---------------------------------------------------------------------------
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  kind conversation_kind not null default 'direct',
  title text,
  direct_key text,
  created_by uuid references profiles(id),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A group must be named; a direct thread takes its name from the other person.
  constraint conversations_group_needs_title
    check (kind <> 'group' or (title is not null and length(btrim(title)) > 0)),
  constraint conversations_direct_needs_key
    check (kind <> 'direct' or direct_key is not null)
);

create unique index if not exists conversations_direct_key_idx
  on conversations (clinic_id, direct_key) where direct_key is not null;

create index if not exists conversations_recent_idx
  on conversations (clinic_id, last_message_at desc nulls last);

drop trigger if exists trg_conversations_updated_at on conversations;
create trigger trg_conversations_updated_at
  before update on conversations
  for each row execute function set_updated_at();

create table if not exists conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  -- Unread is derived from this rather than from per-message receipts: one row per
  -- participant instead of one per participant per message, and it is all the UI needs.
  last_read_at timestamptz,
  muted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create index if not exists conversation_participants_user_idx
  on conversation_participants (user_id);

create table if not exists internal_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  body text not null check (length(btrim(body)) > 0 and length(body) <= 4000),
  -- Soft delete: a retracted message leaves a visible gap rather than silently
  -- rewriting a conversation other people already read.
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists internal_messages_thread_idx
  on internal_messages (conversation_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Participation check.
--
-- security definer on purpose: a policy on conversation_participants that
-- queried conversation_participants would recurse infinitely. This function
-- runs outside RLS, so the policies below can rely on it safely.
-- ---------------------------------------------------------------------------
create or replace function is_conversation_participant(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from conversation_participants cp
    where cp.conversation_id = p_conversation
      and cp.user_id = auth.uid()
  );
$$;

revoke all on function is_conversation_participant(uuid) from public;
grant execute on function is_conversation_participant(uuid) to authenticated;

-- Keep conversation ordering current without the application having to remember.
create or replace function touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_internal_messages_touch on internal_messages;
create trigger trg_internal_messages_touch
  after insert on internal_messages
  for each row execute function touch_conversation_on_message();

-- ---------------------------------------------------------------------------
-- Notifications — one row per recipient, fanned out on write by the server.
-- There is deliberately no client insert policy: notifications are only created
-- through the service-role client, so nobody can forge one.
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind notification_kind not null default 'system',
  title text not null,
  body text,
  /** In-app destination, e.g. /recepcao/fila or /mensagens?conversa=<id>. */
  href text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_inbox_idx
  on notifications (user_id, created_at desc);

create index if not exists notifications_unread_idx
  on notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
alter table conversations enable row level security;
alter table conversation_participants enable row level security;
alter table internal_messages enable row level security;
alter table notifications enable row level security;

drop policy if exists conversations_select on conversations;
create policy conversations_select on conversations for select
  using (is_conversation_participant(id));

-- No client insert policy on conversations or conversation_participants.
--
-- Creating a thread is inherently a two-step write (the row, then its participants) and
-- the first participant cannot yet satisfy a participation check — any policy expressing
-- "unless there are no participants yet" has to reference the same table it guards, which
-- is both a recursion hazard and, unqualified inside a subquery, silently always-true.
-- So both writes go through the service-role client from a Server Action that has already
-- verified clinic membership. Same reasoning as notifications below.

drop policy if exists conversations_update on conversations;
create policy conversations_update on conversations for update
  using (is_conversation_participant(id))
  with check (is_conversation_participant(id));

drop policy if exists conversation_participants_select on conversation_participants;
create policy conversation_participants_select on conversation_participants for select
  using (user_id = auth.uid() or is_conversation_participant(conversation_id));

drop policy if exists conversation_participants_update on conversation_participants;
create policy conversation_participants_update on conversation_participants for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists internal_messages_select on internal_messages;
create policy internal_messages_select on internal_messages for select
  using (is_conversation_participant(conversation_id));

drop policy if exists internal_messages_insert on internal_messages;
create policy internal_messages_insert on internal_messages for insert
  with check (sender_id = auth.uid() and is_conversation_participant(conversation_id));

-- Only the author may retract, and only by soft-deleting.
drop policy if exists internal_messages_update on internal_messages;
create policy internal_messages_update on internal_messages for update
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications for select
  using (user_id = auth.uid());

drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime. With these in the publication the chat thread and the notification
-- bell update by subscription; without them the app falls back to polling, so
-- this is an optimisation rather than a requirement.
-- ---------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table internal_messages;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table notifications;
exception when duplicate_object then null;
end $$;
