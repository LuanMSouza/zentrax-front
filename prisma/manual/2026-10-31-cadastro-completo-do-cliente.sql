-- Cadastro completo do cliente (tudo opcional: o cadastro rápido continua só com o nome).
-- Aniversário em dia + mês separados porque quase ninguém sabe o ano do cliente, e "aniversário hoje" é só comparar
-- os dois números. limite_fiado é só aviso no lançar nota, não bloqueia.
-- Aditivo e idempotente. TEM que rodar ANTES do deploy (o Prisma lê todas as colunas do modelo).
-- Aplicar em produção com:  psql "${DATABASE_URL%%\?*}" -f prisma/manual/2026-10-31-cadastro-completo-do-cliente.sql
ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS apelido         varchar(60),
    ADD COLUMN IF NOT EXISTS email           varchar(120),
    ADD COLUMN IF NOT EXISTS endereco        varchar(160),
    ADD COLUMN IF NOT EXISTS aniversario_dia smallint CHECK (aniversario_dia BETWEEN 1 AND 31),
    ADD COLUMN IF NOT EXISTS aniversario_mes smallint CHECK (aniversario_mes BETWEEN 1 AND 12),
    ADD COLUMN IF NOT EXISTS observacoes     varchar(500),
    ADD COLUMN IF NOT EXISTS limite_fiado    numeric(10,2) CHECK (limite_fiado > 0);
