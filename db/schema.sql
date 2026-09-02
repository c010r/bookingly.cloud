-- Esquema de c010r News. Idempotente: se puede ejecutar tantas veces como haga falta.

CREATE TABLE IF NOT EXISTS sources (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  feed_url    TEXT NOT NULL UNIQUE,
  site_url    TEXT,
  lang        TEXT NOT NULL DEFAULT 'en',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles (
  id                   SERIAL PRIMARY KEY,
  source_id            INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  -- Atribucion: siempre guardamos de donde salio la noticia original.
  source_name          TEXT NOT NULL,
  source_url           TEXT NOT NULL,
  source_title         TEXT NOT NULL,
  source_published_at  TIMESTAMPTZ,
  fingerprint          TEXT NOT NULL UNIQUE,
  status               TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','published','rejected')),
  title                TEXT NOT NULL,
  slug                 TEXT NOT NULL UNIQUE,
  dek                  TEXT,
  body_md              TEXT NOT NULL,
  tags                 TEXT[] NOT NULL DEFAULT '{}',
  seo_title            TEXT,
  seo_description      TEXT,
  image_url            TEXT,
  reading_minutes      INTEGER NOT NULL DEFAULT 1,
  model                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS articles_status_published_idx
  ON articles (status, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS articles_created_idx ON articles (created_at DESC);
CREATE INDEX IF NOT EXISTS articles_tags_idx ON articles USING GIN (tags);

CREATE TABLE IF NOT EXISTS ingest_runs (
  id          SERIAL PRIMARY KEY,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  seen        INTEGER NOT NULL DEFAULT 0,
  created     INTEGER NOT NULL DEFAULT 0,
  skipped     INTEGER NOT NULL DEFAULT 0,
  failed      INTEGER NOT NULL DEFAULT 0,
  detail      TEXT
);

-- Ampliaciones (idempotentes): categoria, deduplicacion y control de calidad.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS category      TEXT NOT NULL DEFAULT 'software';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS title_key     TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS extra_sources JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS quality_score INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS quality_notes TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS auto_published BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS articles_category_idx
  ON articles (category, status, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS articles_title_key_idx ON articles (title_key);

ALTER TABLE ingest_runs ADD COLUMN IF NOT EXISTS duplicates INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ingest_runs ADD COLUMN IF NOT EXISTS published  INTEGER NOT NULL DEFAULT 0;

ALTER TABLE sources ADD COLUMN IF NOT EXISTS category TEXT;

-- Contador de visitas, para el bloque de "mas leidas" del hero.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS articles_views_idx
  ON articles (views DESC) WHERE status = 'published';

-- Tipo de fuente: casi todas son RSS, pero algunas (GitHub) se consultan por API.
ALTER TABLE sources ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'rss';

-- Firma del articulo original, para atribuir a quien lo escribio.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_author TEXT;

-- Modelos apartados temporalmente: agotaron su cupo diario o el proveedor los
-- retiro. Vive en la base de datos porque la ingesta arranca un proceso nuevo
-- cada 5 minutos y, sin esto, cada tanda volveria a chocar contra el mismo
-- muro y gastaria peticiones en errores.
CREATE TABLE IF NOT EXISTS llm_cooldowns (
  model      TEXT PRIMARY KEY,
  reason     TEXT NOT NULL,
  until      TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Noticias que el redactor rechazo por quedar fuera del foco del medio. Se
-- guarda solo la huella para no volver a mandarlas al modelo en cada tanda:
-- la ingesta corre cada 5 minutos y el cupo diario es limitado.
CREATE TABLE IF NOT EXISTS descartes (
  fingerprint TEXT PRIMARY KEY,
  source_url  TEXT NOT NULL,
  title       TEXT NOT NULL,
  motivo      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
