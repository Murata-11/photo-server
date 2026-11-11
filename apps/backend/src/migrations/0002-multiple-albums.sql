DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM photos WHERE album IS NOT NULL AND (length(album)=0 OR NOT EXISTS (SELECT 1 FROM albums WHERE name=photos.album))) THEN
  RAISE EXCEPTION 'Invalid legacy album membership';
 END IF;
END $$;
CREATE TABLE photo_albums (
 photo_id uuid NOT NULL REFERENCES photos(id),
 album_name text NOT NULL REFERENCES albums(name),
 PRIMARY KEY (photo_id, album_name)
);
CREATE INDEX photo_albums_album ON photo_albums(album_name, photo_id);
INSERT INTO photo_albums(photo_id, album_name) SELECT id, album FROM photos WHERE album IS NOT NULL;
DO $$ BEGIN
 IF EXISTS (
  (SELECT id, album FROM photos WHERE album IS NOT NULL EXCEPT SELECT photo_id, album_name FROM photo_albums)
  UNION ALL
  (SELECT photo_id, album_name FROM photo_albums EXCEPT SELECT id, album FROM photos WHERE album IS NOT NULL)
 ) THEN RAISE EXCEPTION 'Album migration verification failed'; END IF;
END $$;
ALTER TABLE photos DROP COLUMN album;
