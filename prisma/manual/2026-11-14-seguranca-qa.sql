-- Correções do QA/pentest de 14/11/26 (qa/RELATORIO.md). Só ADICIONA coisa (colunas com padrão e índices):
-- o app que está no ar continua igual, e o código novo também funciona ANTES desta migração (lê as colunas novas
-- por SQL com plano B; ver lib/sessao.ts e lib/linkExtrato.ts). Pode rodar mais de uma vez.
--
-- Rodar em produção ANTES do push (fora do horário de pico é melhor, mas as tabelas são pequenas: leva < 1 s):
--   psql "${DATABASE_URL%%\?*}" -v ON_ERROR_STOP=1 -f prisma/manual/2026-11-14-seguranca-qa.sql
--
-- Desfazer (se precisar voltar a main anterior, NÃO é obrigatório: o código antigo ignora tudo isto):
--   DROP INDEX IF EXISTS usuarios_usuario_lower_key, pagamentos_nota_abatida_idx, pagamentos_empresa_cliente_idx,
--                        recibos_id_cliente_idx;
--   ALTER TABLE usuarios DROP COLUMN IF EXISTS sessao_versao;
--   ALTER TABLE clientes DROP COLUMN IF EXISTS extrato_versao;

\set ON_ERROR_STOP 1

-- M3: o login não pode existir duas vezes só mudando maiúscula ("gestor.a" e "GESTOR.A" derrubavam um ao outro).
-- Conferência antes de criar o índice (em 14/11/26 a produção tinha 0 duplicados): se aparecer algum, o CREATE
-- abaixo falha e nada muda; aí é renomear um dos dois e rodar de novo.
SELECT lower(usuario) AS login_duplicado, count(*) FROM usuarios GROUP BY 1 HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_usuario_lower_key ON usuarios (lower(usuario));

-- M1: versão da sessão. Cada login grava a versão atual no token; logout, troca/redefinição de senha e mudança de
-- papel somam 1 aqui, e todo token com a versão antiga para de valer na hora.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sessao_versao integer NOT NULL DEFAULT 0;

-- B10: "desativar links do extrato" soma 1 aqui e os links/QRs já mandados pra esse cliente param de abrir.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS extrato_versao integer NOT NULL DEFAULT 0;

-- B16: índices que faltavam (as consultas do selo de pagador, do extrato e do desfazer faziam seq scan).
CREATE INDEX IF NOT EXISTS pagamentos_nota_abatida_idx ON pagamentos (nota_abatida);
CREATE INDEX IF NOT EXISTS pagamentos_empresa_cliente_idx ON pagamentos (empresa_id, id_cliente);
CREATE INDEX IF NOT EXISTS recibos_id_cliente_idx ON recibos (id_cliente);

-- Conferência final: tem que mostrar as 2 colunas e os 4 índices.
SELECT table_name, column_name, data_type, column_default FROM information_schema.columns
 WHERE (table_name, column_name) IN (('usuarios', 'sessao_versao'), ('clientes', 'extrato_versao'));
SELECT indexname FROM pg_indexes WHERE indexname IN
 ('usuarios_usuario_lower_key', 'pagamentos_nota_abatida_idx', 'pagamentos_empresa_cliente_idx', 'recibos_id_cliente_idx');
