-- Logo da loja no topo do comprovante impresso (Configurações > Preferências).
-- Guardada como data URL PNG já reduzida pra largura da bobina (até 384px), por isso cabe numa coluna de texto.
-- Só adiciona uma coluna vazia: o app que está no ar continua igual. Pode rodar mais de uma vez.
--
-- Aplicar em produção ANTES do push que muda o schema.prisma:
--   psql "${DATABASE_URL%%\?*}" -f prisma/manual/2026-10-31-logo-comprovante.sql

ALTER TABLE empresa_settings
    ADD COLUMN IF NOT EXISTS logo_comprovante text CHECK (length(logo_comprovante) <= 200000);
