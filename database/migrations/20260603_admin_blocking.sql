ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false NOT NULL;
ALTER TABLE groups   ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false NOT NULL;
