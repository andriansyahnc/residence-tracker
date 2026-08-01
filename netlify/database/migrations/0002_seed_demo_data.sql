INSERT INTO residences (id, name, created_at)
VALUES ('res-1', 'Oak Residence', '2026-08-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, email, display_name, created_at) VALUES
  ('user-resident', 'resident@example.com', 'Alex Resident', '2026-08-01T00:00:00Z'),
  ('user-manager', 'manager@example.com', 'Morgan Manager', '2026-08-01T00:00:00Z'),
  ('user-other', 'other@example.com', 'Other Resident', '2026-08-01T00:00:00Z'),
  ('user-nomember', 'nomember@example.com', 'No Membership User', '2026-08-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (id, user_id, residence_id, role, created_at) VALUES
  ('mem-resident', 'user-resident', 'res-1', 'resident', '2026-08-01T00:00:00Z'),
  ('mem-manager', 'user-manager', 'res-1', 'manager', '2026-08-01T00:00:00Z'),
  ('mem-other', 'user-other', 'res-1', 'resident', '2026-08-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
