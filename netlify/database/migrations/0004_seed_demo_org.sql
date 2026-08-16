-- Demo org bootstrap: just enough rows for the three demo accounts to sign in.
-- The full demo dataset (units, periods, dues, proofs, expenses, reports,
-- problems) is written by src/db/demo-seed.ts. On a deployed site the demo
-- manager fills it by pressing "Reset data demo" once.

INSERT INTO residences (id, name, created_at)
VALUES ('res-demo', 'Griya Asri Demo', '2026-06-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO management_groups (id, name, created_at)
VALUES ('mg-demo', 'Pengurus Griya Asri Demo', '2026-06-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO management_group_residences (management_group_id, residence_id, sort_order, created_at)
VALUES ('mg-demo', 'res-demo', 1, '2026-06-01T00:00:00Z')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (id, email, display_name, created_at) VALUES
  ('demo-user-manager', 'demo.manager@example.com', 'Pak Budi (Ketua)', '2026-06-01T00:00:00Z'),
  ('demo-user-warga', 'demo.warga@example.com', 'Ibu Sari (Warga)', '2026-06-01T00:00:00Z'),
  ('demo-user-bendahara', 'demo.bendahara@example.com', 'Pak Anton (Bendahara)', '2026-06-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (id, user_id, residence_id, role, created_at) VALUES
  ('demo-mem-manager', 'demo-user-manager', 'res-demo', 'manager', '2026-06-01T00:00:00Z'),
  ('demo-mem-warga', 'demo-user-warga', 'res-demo', 'resident', '2026-06-01T00:00:00Z'),
  ('demo-mem-bendahara', 'demo-user-bendahara', 'res-demo', 'accountant', '2026-06-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
