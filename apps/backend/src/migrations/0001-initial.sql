CREATE TABLE IF NOT EXISTS albums (
 name text PRIMARY KEY CHECK (length(name) BETWEEN 1 AND 100)
);
CREATE TABLE IF NOT EXISTS photos (
 id uuid PRIMARY KEY,
 filename text NOT NULL,
 media_type text NOT NULL,
 size_bytes bigint NOT NULL CHECK (size_bytes > 0),
 sha256 char(64) NOT NULL,
 uploaded_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 favorite boolean NOT NULL DEFAULT false,
 deleted boolean NOT NULL DEFAULT false,
 album text REFERENCES albums(name),
 metadata jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS photos_order ON photos(created_at DESC, id DESC);
