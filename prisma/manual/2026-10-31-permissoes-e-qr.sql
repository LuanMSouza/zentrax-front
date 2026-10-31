-- O que o gestor libera pros atendentes (Configurações > Conta) e se o comprovante imprime o QR code das notas.
-- Permissões começam todas desligadas ('{}' = atendente igual a hoje) e o QR começa ligado (igual a hoje).
-- Só adiciona colunas com padrão: o app que está no ar continua igual. Pode rodar mais de uma vez.
--
-- Aplicar em produção ANTES do push que muda o schema.prisma:
--   psql "${DATABASE_URL%%\?*}" -f prisma/manual/2026-10-31-permissoes-e-qr.sql

ALTER TABLE empresa_settings
    ADD COLUMN IF NOT EXISTS permissoes_atendente jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS qr_extrato boolean NOT NULL DEFAULT true;
