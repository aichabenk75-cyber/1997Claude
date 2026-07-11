-- Stockage des photos de posts directement en base (bytea).
-- Choix DEV/V1 sans dépendance S3 : suffisant pour les tests ; en production,
-- ces blobs migreront vers un object storage UE + CDN (post_media.s3_key
-- contient déjà une clé opaque, la migration sera transparente pour l'app).
CREATE TABLE IF NOT EXISTS media_blobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime        text NOT NULL,
  bytes       bytea NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_blobs_owner ON media_blobs(owner_id);
