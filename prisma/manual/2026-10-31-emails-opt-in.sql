-- E-mails pro dono da loja (aviso de vencimento e resumo do mês) passam a ser "só se quiser": a loja responde uma
-- pergunta no app e só depois disso recebe. Enquanto a coluna é nula, nenhum dos dois e-mails sai.
-- Só adiciona uma coluna vazia. Pode rodar mais de uma vez.
--
-- Aplicar em produção ANTES do push que muda o schema.prisma:
--   psql "${DATABASE_URL%%\?*}" -f prisma/manual/2026-10-31-emails-opt-in.sql

ALTER TABLE empresa_settings
    ADD COLUMN IF NOT EXISTS emails_respondido_em timestamptz;
