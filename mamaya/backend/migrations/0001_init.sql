-- Mamaya — migration initiale (PostgreSQL 16 + PostGIS)
-- Reprend le DDL validé à l'Étape 2, complété par les tables du module auth
-- (refresh_tokens, totp_backup_codes, user_keys) et les jetons email.
-- Idempotente au premier ordre : à exécuter sur une base vierge.

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- uuidv7() n'est pas natif en PG16 (arrive en PG18) — implémentation SQL de
-- référence : UUID v4 dont les 48 premiers bits sont remplacés par le
-- timestamp ms + bits de version forcés à 7 → identifiants triables par temps.
CREATE OR REPLACE FUNCTION uuidv7() RETURNS uuid AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid())
          placing substring(int8send((extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
          FROM 1 FOR 6),
        52, 1),
      53, 1),
    'hex')::uuid;
$$ LANGUAGE sql VOLATILE;

-- =====================================================================
-- 1. IDENTITÉ
-- =====================================================================

CREATE TYPE user_status AS ENUM ('enceinte', 'maman', 'essai_bebe');
CREATE TYPE auth_provider AS ENUM ('email', 'google', 'apple');

CREATE TABLE users (
    id                uuid PRIMARY KEY DEFAULT uuidv7(),
    email             citext UNIQUE NOT NULL,
    email_verified_at timestamptz,
    password_hash     text,
    provider          auth_provider NOT NULL DEFAULT 'email',
    provider_sub      text,
    totp_secret_enc   bytea,
    totp_enabled      boolean NOT NULL DEFAULT false,
    role              text NOT NULL DEFAULT 'member',
    status            user_status NOT NULL,
    due_date          date,
    locale            text NOT NULL DEFAULT 'fr',
    created_at        timestamptz NOT NULL DEFAULT now(),
    deleted_at        timestamptz
);
CREATE UNIQUE INDEX uq_users_provider_sub ON users(provider, provider_sub)
    WHERE provider_sub IS NOT NULL;

CREATE TABLE user_profiles (
    user_id      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name text NOT NULL,
    bio          text,
    avatar_url   text,
    city_label   text,
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE children (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name_enc  bytea,
    birthdate_enc   bytea,
    birth_month     date NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_children_user ON children(user_id);
CREATE INDEX idx_children_birth_month ON children(birth_month);

CREATE TABLE interests (
    id    smallint PRIMARY KEY,
    slug  text UNIQUE NOT NULL,
    label text NOT NULL
);
CREATE TABLE user_interests (
    user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
    interest_id smallint REFERENCES interests(id),
    PRIMARY KEY (user_id, interest_id)
);

CREATE TABLE badges (
    id          smallint PRIMARY KEY,
    slug        text UNIQUE NOT NULL,
    label       text NOT NULL,
    description text
);
CREATE TABLE user_badges (
    user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
    badge_id   smallint REFERENCES badges(id),
    awarded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE consents (
    id         uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       text NOT NULL,
    version    text NOT NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz
);
CREATE INDEX idx_consents_user_kind ON consents(user_id, kind);

CREATE TABLE deletion_requests (
    user_id      uuid PRIMARY KEY REFERENCES users(id),
    requested_at timestamptz NOT NULL DEFAULT now(),
    purge_after  timestamptz NOT NULL,
    purged_at    timestamptz
);

-- =====================================================================
-- 2. AUTH (sessions, 2FA, clés de chiffrement)
-- =====================================================================

-- Refresh tokens opaques stockés hachés ; family_id = chaîne de rotations
-- d'un appareil (détection de rejeu → révocation de la famille entière).
CREATE TABLE refresh_tokens (
    id           uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id    uuid NOT NULL,
    token_hash   text UNIQUE NOT NULL,
    expires_at   timestamptz NOT NULL,
    used_at      timestamptz,
    revoked_at   timestamptz,
    device_label text,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);

CREATE TABLE totp_backup_codes (
    user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash text NOT NULL,
    used_at   timestamptz,
    PRIMARY KEY (user_id, code_hash)
);

-- EDK : clé de données par utilisatrice, chiffrée par la clé maîtresse KMS.
-- Sa suppression = crypto-shredding de toutes les données P0 de l'utilisatrice.
CREATE TABLE user_keys (
    user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    edk        bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    rotated_at timestamptz
);

-- Jetons à usage unique (vérification email, réinitialisation mot de passe).
CREATE TABLE one_time_tokens (
    token_hash text PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       text NOT NULL,          -- 'verify_email' | 'password_reset'
    expires_at timestamptz NOT NULL,
    used_at    timestamptz
);
CREATE INDEX idx_ott_user ON one_time_tokens(user_id, kind);

-- =====================================================================
-- 3. COMMUNAUTÉ
-- =====================================================================

CREATE TYPE post_type AS ENUM ('texte', 'photo', 'sondage');
CREATE TYPE moderation_state AS ENUM ('en_attente', 'approuve', 'rejete', 'revue_humaine');

CREATE TABLE categories (
    id    smallint PRIMARY KEY,
    slug  text UNIQUE NOT NULL,
    label text NOT NULL
);

CREATE TABLE posts (
    id             uuid PRIMARY KEY DEFAULT uuidv7(),
    author_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type           post_type NOT NULL DEFAULT 'texte',
    body           text,
    category_id    smallint REFERENCES categories(id),
    audience_stage text,
    moderation     moderation_state NOT NULL DEFAULT 'en_attente',
    like_count     integer NOT NULL DEFAULT 0,
    comment_count  integer NOT NULL DEFAULT 0,
    share_count    integer NOT NULL DEFAULT 0,
    created_at     timestamptz NOT NULL DEFAULT now(),
    deleted_at     timestamptz
);
CREATE INDEX idx_posts_feed ON posts (created_at DESC)
    WHERE moderation = 'approuve' AND deleted_at IS NULL;
CREATE INDEX idx_posts_category ON posts (category_id, created_at DESC)
    WHERE moderation = 'approuve' AND deleted_at IS NULL;
CREATE INDEX idx_posts_stage ON posts (audience_stage, created_at DESC)
    WHERE moderation = 'approuve' AND deleted_at IS NULL;
CREATE INDEX idx_posts_author ON posts (author_id, created_at DESC);

CREATE TABLE post_media (
    id       uuid PRIMARY KEY DEFAULT uuidv7(),
    post_id  uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    s3_key   text NOT NULL,
    width    int,
    height   int,
    position smallint NOT NULL DEFAULT 0
);
CREATE INDEX idx_post_media_post ON post_media(post_id);

CREATE TABLE polls (
    post_id   uuid PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
    closes_at timestamptz
);
CREATE TABLE poll_options (
    id       uuid PRIMARY KEY DEFAULT uuidv7(),
    post_id  uuid NOT NULL REFERENCES polls(post_id) ON DELETE CASCADE,
    label    text NOT NULL,
    position smallint NOT NULL
);
CREATE TABLE poll_votes (
    option_id uuid REFERENCES poll_options(id) ON DELETE CASCADE,
    user_id   uuid REFERENCES users(id) ON DELETE CASCADE,
    voted_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (option_id, user_id)
);

CREATE TABLE comments (
    id         uuid PRIMARY KEY DEFAULT uuidv7(),
    post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id  uuid REFERENCES comments(id),
    body       text NOT NULL,
    moderation moderation_state NOT NULL DEFAULT 'en_attente',
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
CREATE INDEX idx_comments_post ON comments (post_id, created_at);

CREATE TYPE reaction_target AS ENUM ('post', 'comment');
CREATE TABLE reactions (
    user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
    target_type reaction_target NOT NULL,
    target_id   uuid NOT NULL,
    kind        text NOT NULL DEFAULT 'soutien',
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, target_type, target_id)
);
CREATE INDEX idx_reactions_target ON reactions (target_type, target_id);

CREATE TABLE tags (
    id   serial PRIMARY KEY,
    slug text UNIQUE NOT NULL
);
CREATE TABLE post_tags (
    post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
    tag_id  int REFERENCES tags(id),
    PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE follows (
    follower_id uuid REFERENCES users(id) ON DELETE CASCADE,
    followee_id uuid REFERENCES users(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);
CREATE INDEX idx_follows_followee ON follows(followee_id);

-- =====================================================================
-- 4. CHAT
-- =====================================================================

CREATE TYPE conversation_type AS ENUM ('dm', 'groupe_prive', 'groupe_public');

CREATE TABLE conversations (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    type        conversation_type NOT NULL,
    title       text,
    description text,
    avatar_url  text,
    dm_key      text UNIQUE,
    created_by  uuid REFERENCES users(id),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversation_members (
    conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
    role            text NOT NULL DEFAULT 'member',
    joined_at       timestamptz NOT NULL DEFAULT now(),
    last_read_at    timestamptz,
    muted           boolean NOT NULL DEFAULT false,
    PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX idx_members_user ON conversation_members(user_id);

CREATE TABLE messages (
    id              uuid NOT NULL DEFAULT uuidv7(),
    conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body_enc        bytea NOT NULL,
    key_id          text NOT NULL,
    media_s3_key    text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_messages_conv ON messages (conversation_id, created_at DESC);

-- Partitions initiales (3 mois) + défaut. En prod : job mensuel BullMQ
-- (ou pg_partman) qui crée la partition M+2 en avance.
CREATE TABLE messages_2026_07 PARTITION OF messages
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE messages_2026_08 PARTITION OF messages
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE messages_2026_09 PARTITION OF messages
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE messages_default PARTITION OF messages DEFAULT;

-- =====================================================================
-- 5. GÉOLOCALISATION
-- =====================================================================

CREATE TABLE user_locations (
    user_id      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    geo          geography(Point, 4326) NOT NULL,  -- position FLOUTÉE (~1 km)
    geohash5     text NOT NULL,
    ghost_mode   boolean NOT NULL DEFAULT false,
    consented_at timestamptz NOT NULL,
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_locations_geo ON user_locations USING GIST (geo)
    WHERE ghost_mode = false;

-- =====================================================================
-- 6. SÛRETÉ & MODÉRATION
-- =====================================================================

CREATE TYPE report_target AS ENUM ('post', 'comment', 'user', 'message');
CREATE TYPE report_status AS ENUM ('ouvert', 'en_cours', 'traite', 'rejete');

CREATE TABLE reports (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type report_target NOT NULL,
    target_id   uuid NOT NULL,
    reason      text NOT NULL,
    details     text,
    status      report_status NOT NULL DEFAULT 'ouvert',
    handled_by  uuid REFERENCES users(id),
    handled_at  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_open ON reports (created_at) WHERE status = 'ouvert';

CREATE TABLE banned_words (
    id       serial PRIMARY KEY,
    pattern  text NOT NULL,
    severity text NOT NULL DEFAULT 'bloquer'
);

CREATE TABLE moderation_actions (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    target_type report_target NOT NULL,
    target_id   uuid NOT NULL,
    actor       text NOT NULL,
    action      text NOT NULL,
    reason      text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_moderation_actions_target ON moderation_actions(target_type, target_id);

CREATE TABLE user_blocks (
    blocker_id uuid REFERENCES users(id) ON DELETE CASCADE,
    blocked_id uuid REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_id);

-- =====================================================================
-- 7. TECHNIQUE
-- =====================================================================

CREATE TABLE devices (
    id         uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform   text NOT NULL,
    push_token text NOT NULL,
    last_seen  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, push_token)
);

CREATE TABLE notifications (
    id         uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       text NOT NULL,
    payload    jsonb NOT NULL,
    read_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC)
    WHERE read_at IS NULL;

CREATE TABLE audit_logs (
    id         bigserial PRIMARY KEY,
    actor_id   uuid,
    action     text NOT NULL,
    target     text,
    ip_hash    text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);

-- =====================================================================
-- 8. DONNÉES DE RÉFÉRENCE (seed minimal)
-- =====================================================================

INSERT INTO categories (id, slug, label) VALUES
  (1, 'allaitement',  'Allaitement 🤱'),
  (2, 'sommeil',      'Sommeil 😴'),
  (3, 'accouchement', 'Accouchement 👶'),
  (4, 'sante',        'Santé 🩺'),
  (5, 'alimentation', 'Alimentation 🥣'),
  (6, 'bien-etre',    'Bien-être 💛'),
  (7, 'organisation', 'Organisation & famille 📅');

INSERT INTO interests (id, slug, label) VALUES
  (1, 'allaitement',  'Allaitement'),
  (2, 'sommeil',      'Sommeil'),
  (3, 'accouchement', 'Accouchement'),
  (4, 'sante',        'Santé'),
  (5, 'sport',        'Sport & forme'),
  (6, 'diy',          'DIY & activités'),
  (7, 'reprise-travail', 'Reprise du travail');

INSERT INTO badges (id, slug, label, description) VALUES
  (1, 'bienvenue',         'Bienvenue 💛',        'Profil complété'),
  (2, 'premiere-question', 'Première question',   'Premier post publié'),
  (3, 'soutien-10',        'Épaule solide',       '10 soutiens donnés'),
  (4, 'conseillere',       'Conseillère',         '10 commentaires utiles'),
  (5, 'top-contributrice', 'Top contributrice ⭐', '100 contributions approuvées');

COMMIT;
