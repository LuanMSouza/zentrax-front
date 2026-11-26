-- Programa de parceiros (indicação externa com comissão): contadores, consultores, outras empresas.
-- O parceiro ganha um código; quem cria conta pelo link ...?ref=CODIGO fica ligado a ele (empresa.parceiro_id).
-- A comissão é paga por fora (Pix), com base no relatório de /api/admin/parceiros.
-- Aditivo e idempotente. Rodar ANTES do deploy (o Prisma lê todas as colunas do modelo).
-- Aplicar em produção com:  psql "${DATABASE_URL%%\?*}" -f prisma/manual/2026-11-26-parceiros.sql
CREATE TABLE IF NOT EXISTS parceiros (
    id         serial PRIMARY KEY,
    nome       varchar(120) NOT NULL,
    codigo     varchar(12)  NOT NULL UNIQUE,
    percentual smallint     NOT NULL DEFAULT 30 CHECK (percentual BETWEEN 1 AND 100),
    meses      smallint     NOT NULL DEFAULT 12 CHECK (meses BETWEEN 1 AND 60),
    contato    varchar(120),
    ativo      boolean      NOT NULL DEFAULT true,
    criado_em  timestamp    NOT NULL DEFAULT now()
);

ALTER TABLE empresa ADD COLUMN IF NOT EXISTS parceiro_id integer REFERENCES parceiros(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS empresa_parceiro_id_idx ON empresa (parceiro_id);
