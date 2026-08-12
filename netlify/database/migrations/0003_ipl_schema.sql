-- IPL add-on tables (after 0001_initial_schema + 0002_seed_demo_data)

CREATE TABLE management_groups (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE management_group_residences (
  management_group_id TEXT NOT NULL REFERENCES management_groups(id),
  residence_id TEXT NOT NULL REFERENCES residences(id),
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (management_group_id, residence_id)
);
CREATE UNIQUE INDEX mgr_residence_unique ON management_group_residences (residence_id);
CREATE UNIQUE INDEX mgr_sort_unique ON management_group_residences (management_group_id, sort_order);

CREATE TABLE units (
  id TEXT PRIMARY KEY NOT NULL,
  residence_id TEXT NOT NULL REFERENCES residences(id),
  label TEXT NOT NULL,
  luas_tanah_m2 NUMERIC(10, 2) NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX units_residence_label_unique ON units (residence_id, label);

CREATE TABLE unit_memberships (
  id TEXT PRIMARY KEY NOT NULL,
  unit_id TEXT NOT NULL REFERENCES units(id),
  membership_id TEXT NOT NULL REFERENCES memberships(id),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX unit_memberships_unit_membership_unique ON unit_memberships (unit_id, membership_id);
CREATE INDEX unit_memberships_membership_idx ON unit_memberships (membership_id);

CREATE TABLE ipl_rates (
  residence_id TEXT PRIMARY KEY NOT NULL REFERENCES residences(id),
  fee_per_m2_idr BIGINT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL REFERENCES profiles(id)
);

CREATE TABLE ipl_periods (
  id TEXT PRIMARY KEY NOT NULL,
  management_group_id TEXT NOT NULL REFERENCES management_groups(id),
  year_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  opened_at TEXT NOT NULL,
  opened_by_user_id TEXT NOT NULL REFERENCES profiles(id)
);
CREATE UNIQUE INDEX ipl_periods_group_month_unique ON ipl_periods (management_group_id, year_month);

CREATE TABLE ipl_dues (
  id TEXT PRIMARY KEY NOT NULL,
  period_id TEXT NOT NULL REFERENCES ipl_periods(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  residence_id TEXT NOT NULL REFERENCES residences(id),
  luas_snapshot_m2 NUMERIC(10, 2) NOT NULL,
  fee_per_m2_snapshot_idr BIGINT NOT NULL,
  amount_idr BIGINT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX ipl_dues_period_unit_unique ON ipl_dues (period_id, unit_id);
CREATE INDEX ipl_dues_period_residence_idx ON ipl_dues (period_id, residence_id);

CREATE TABLE ipl_payment_proofs (
  id TEXT PRIMARY KEY NOT NULL,
  due_id TEXT NOT NULL REFERENCES ipl_dues(id),
  blob_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  status TEXT NOT NULL,
  uploaded_by_user_id TEXT NOT NULL REFERENCES profiles(id),
  uploaded_at TEXT NOT NULL,
  reviewed_by_user_id TEXT REFERENCES profiles(id),
  reviewed_at TEXT,
  review_note TEXT
);
CREATE INDEX ipl_payment_proofs_due_idx ON ipl_payment_proofs (due_id);
CREATE INDEX ipl_payment_proofs_status_uploaded_idx ON ipl_payment_proofs (status, uploaded_at);
CREATE UNIQUE INDEX ipl_payment_proofs_active_due_uidx
  ON ipl_payment_proofs (due_id)
  WHERE status IN ('pending', 'verified');

CREATE TABLE luas_change_requests (
  id TEXT PRIMARY KEY NOT NULL,
  unit_id TEXT NOT NULL REFERENCES units(id),
  proposed_luas_m2 NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL REFERENCES profiles(id),
  requested_at TEXT NOT NULL,
  reviewed_by_user_id TEXT REFERENCES profiles(id),
  reviewed_at TEXT,
  review_note TEXT
);
CREATE UNIQUE INDEX luas_change_requests_pending_unit_uidx
  ON luas_change_requests (unit_id)
  WHERE status = 'pending';

CREATE TABLE expenses (
  id TEXT PRIMARY KEY NOT NULL,
  management_group_id TEXT NOT NULL REFERENCES management_groups(id),
  period_id TEXT NOT NULL REFERENCES ipl_periods(id),
  category TEXT NOT NULL,
  amount_idr BIGINT NOT NULL,
  expense_date TEXT NOT NULL,
  note TEXT,
  receipt_blob_key TEXT,
  receipt_mime_type TEXT,
  receipt_byte_size INTEGER,
  created_by_user_id TEXT NOT NULL REFERENCES profiles(id),
  updated_by_user_id TEXT NOT NULL REFERENCES profiles(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX expenses_period_date_idx ON expenses (period_id, expense_date);

CREATE TABLE monthly_reports (
  period_id TEXT PRIMARY KEY NOT NULL REFERENCES ipl_periods(id),
  keterangan TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL REFERENCES profiles(id)
);
