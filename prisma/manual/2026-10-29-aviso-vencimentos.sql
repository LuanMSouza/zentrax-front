-- E-mail da manhã pro dono da loja com o fiado que vence hoje e o que venceu ontem sem pagar.
-- avisar_vencimentos: liga/desliga em Configurações › Preferências (ligado por padrão; só manda e-mail se alguma nota
-- tem data combinada, então quem não usa a data combinada nunca recebe nada).
-- ultimo_aviso_vencimentos: trava de "no máximo 1 e-mail por dia" mesmo se o cron rodar duas vezes.
-- Aditivo e idempotente. TEM que rodar ANTES do deploy (o Prisma lê todas as colunas do modelo).
-- Aplicar em produção com:  psql "${DATABASE_URL%%\?*}" -f prisma/manual/2026-10-29-aviso-vencimentos.sql
ALTER TABLE empresa_settings
    ADD COLUMN IF NOT EXISTS avisar_vencimentos       boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS ultimo_aviso_vencimentos date;
