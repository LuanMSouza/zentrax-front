-- Pix da loja, resumo do mês por e-mail, cliente bloqueado pra fiado e desfazer pagamento.
-- Só adiciona colunas (vazias ou com padrão): o app que está no ar continua igual. Pode rodar mais de uma vez.
--
-- Aplicar em produção ANTES do push que muda o schema.prisma:
--   psql "${DATABASE_URL%%\?*}" -f prisma/manual/2026-10-31-pix-bloqueio-estorno-resumo.sql

ALTER TABLE empresa_settings
    ADD COLUMN IF NOT EXISTS pix_chave varchar(77),
    ADD COLUMN IF NOT EXISTS pix_nome varchar(25),
    ADD COLUMN IF NOT EXISTS pix_cidade varchar(15),
    ADD COLUMN IF NOT EXISTS resumo_mensal boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS ultimo_resumo_mensal date;

ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT false;

-- recibo desfeito continua existindo (a numeração não fica com buraco), marcado como estornado
ALTER TABLE recibos
    ADD COLUMN IF NOT EXISTS estornado_em timestamptz,
    ADD COLUMN IF NOT EXISTS estornado_por varchar(120);
