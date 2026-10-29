-- Data combinada pra pagar: cada nota (venda no fiado) pode ter o dia que o cliente combinou de pagar. Opcional:
-- nota sem vencimento continua usando a regra antiga (atrasada depois de 30 dias da venda).
-- Aditivo e idempotente. TEM que rodar ANTES do deploy (o Prisma lê todas as colunas do modelo).
-- Aplicar em produção com:  psql "${DATABASE_URL%%\?*}" -f prisma/manual/2026-10-29-vencimento-da-nota.sql
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS vencimento date;
