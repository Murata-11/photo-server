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
 metadata jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS photos_order ON photos(created_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS photo_albums (
 photo_id uuid NOT NULL REFERENCES photos(id),
 album_name text NOT NULL REFERENCES albums(name),
 PRIMARY KEY (photo_id, album_name)
);
CREATE INDEX IF NOT EXISTS photo_albums_album ON photo_albums(album_name, photo_id);
CREATE TABLE IF NOT EXISTS schema_migrations (
 version integer PRIMARY KEY,
 checksum text NOT NULL,
 applied_at timestamptz NOT NULL DEFAULT now()
);
