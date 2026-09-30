-- Comprovante de pagamento: cada pagamento registrado vira um recibo numerado (por empresa), com hora, forma de
-- pagamento, quem registrou e o saldo do cliente logo depois. As linhas de `pagamentos` (uma por nota abatida)
-- passam a apontar pro recibo que as gerou; as antigas ficam com recibo_id nulo e continuam aparecendo agrupadas
-- por cliente + dia, como antes.
-- Também: telefone, endereço e rodapé do comprovante em empresa_settings.
-- Aditivo e idempotente (só ADD/CREATE IF NOT EXISTS). TEM que rodar ANTES do deploy: o Prisma lê todas as colunas
-- do modelo, então o código novo quebra a aba Pagamentos se pagamentos.recibo_id ainda não existir.
-- Aplicar em produção com:  psql "${DATABASE_URL%%\?*}" -f prisma/manual/2026-09-30-recibos-e-cabecalho.sql
CREATE TABLE IF NOT EXISTS recibos (
    id          serial PRIMARY KEY,
    empresa_id  integer        NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    numero      integer        NOT NULL,
    id_cliente  integer        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    usuario_id  integer        REFERENCES usuarios(id) ON DELETE SET NULL,
    atendente   varchar(120),
    valor       numeric(10, 2) NOT NULL,
    forma       varchar(15)    NOT NULL,
    saldo_apos  numeric(10, 2) NOT NULL DEFAULT 0,
    criado_em   timestamptz    NOT NULL DEFAULT now(),
    CONSTRAINT recibos_empresa_numero_key UNIQUE (empresa_id, numero)
);

ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS recibo_id integer REFERENCES recibos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS pagamentos_recibo_id_idx ON pagamentos (recibo_id);

ALTER TABLE empresa_settings
    ADD COLUMN IF NOT EXISTS telefone           varchar(20),
    ADD COLUMN IF NOT EXISTS endereco           varchar(120),
    ADD COLUMN IF NOT EXISTS rodape_comprovante varchar(80);
