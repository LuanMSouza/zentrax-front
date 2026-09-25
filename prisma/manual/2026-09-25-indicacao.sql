-- Programa de indicação: 1 mês grátis pra quem indica, por indicação.
-- Aditivo e idempotente (só ADD/CREATE IF NOT EXISTS): pode rodar antes do
-- deploy sem afetar o app em produção, que ignora colunas/tabelas que não conhece.
-- Aplicar em produção com:  psql "$DATABASE_URL" -f prisma/manual/2026-09-25-indicacao.sql
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS codigo_indicacao varchar(12);
CREATE UNIQUE INDEX IF NOT EXISTS empresa_codigo_indicacao_key ON empresa (codigo_indicacao);

CREATE TABLE IF NOT EXISTS indicacoes (
    id               serial PRIMARY KEY,
    indicador_id     integer   NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    indicada_id      integer   NOT NULL UNIQUE REFERENCES empresa(id) ON DELETE CASCADE,
    criada_em        timestamp NOT NULL DEFAULT now(),
    dias_creditados  integer   NOT NULL DEFAULT 0,
    credito_pendente boolean   NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS indicacoes_indicador_id_idx ON indicacoes (indicador_id);
