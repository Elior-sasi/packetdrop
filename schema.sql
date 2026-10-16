-- Run once in the project's own Postgres/Neon SQL editor before enabling name editing.
CREATE TABLE IF NOT EXISTS parcel_titles (
 user_id text NOT NULL,
 parcel_key text NOT NULL,
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 180),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,parcel_key)
);
