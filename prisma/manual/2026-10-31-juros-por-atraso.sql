-- Juros por atraso, opcional, por empresa (Configurações > Preferências).
-- Só adiciona colunas com valor padrão "desligado": o app que está no ar continua igual.
-- Pode rodar mais de uma vez (IF NOT EXISTS).
--
-- Aplicar em produção ANTES do push que muda o schema.prisma:
--   psql "${DATABASE_URL%%\?*}" -f prisma/manual/2026-10-31-juros-por-atraso.sql

ALTER TABLE empresa_settings
    ADD COLUMN IF NOT EXISTS juros_ativo boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS juros_mes numeric(5,2) NOT NULL DEFAULT 0 CHECK (juros_mes BETWEEN 0 AND 20),
    ADD COLUMN IF NOT EXISTS multa_atraso numeric(5,2) NOT NULL DEFAULT 0 CHECK (multa_atraso BETWEEN 0 AND 20),
    ADD COLUMN IF NOT EXISTS juros_carencia smallint NOT NULL DEFAULT 0 CHECK (juros_carencia BETWEEN 0 AND 90);
