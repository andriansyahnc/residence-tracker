-- Roles above a residence, plus the record of every "sign in as someone else".

CREATE TABLE IF NOT EXISTS platform_roles (
  user_id text PRIMARY KEY REFERENCES profiles(id),
  role text NOT NULL,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS impersonation_log (
  id text PRIMARY KEY,
  actor_user_id text NOT NULL REFERENCES profiles(id),
  target_user_id text NOT NULL REFERENCES profiles(id),
  started_at text NOT NULL,
  ended_at text
);

CREATE INDEX IF NOT EXISTS impersonation_log_actor_idx
  ON impersonation_log (actor_user_id, started_at);

-- The first superadmin. Without this nobody can reach /admin.
INSERT INTO profiles (id, email, display_name, created_at)
VALUES ('user-superadmin', '4andriansyah@gmail.com', 'Super Admin', '2026-08-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform_roles (user_id, role, created_at)
VALUES ('user-superadmin', 'superadmin', '2026-08-01T00:00:00Z')
ON CONFLICT (user_id) DO NOTHING;
