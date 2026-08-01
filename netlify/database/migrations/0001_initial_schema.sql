CREATE TABLE residences (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX profiles_email_unique ON profiles (email);

CREATE TABLE memberships (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  residence_id TEXT NOT NULL REFERENCES residences(id),
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX memberships_user_residence_idx ON memberships (user_id, residence_id);

CREATE TABLE problems (
  id TEXT PRIMARY KEY NOT NULL,
  residence_id TEXT NOT NULL REFERENCES residences(id),
  reporter_user_id TEXT NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  unit TEXT,
  category TEXT,
  status TEXT DEFAULT 'submitted' NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status_changed_at TEXT NOT NULL
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY NOT NULL,
  problem_id TEXT NOT NULL REFERENCES problems(id),
  residence_id TEXT NOT NULL REFERENCES residences(id),
  author_user_id TEXT NOT NULL REFERENCES profiles(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
