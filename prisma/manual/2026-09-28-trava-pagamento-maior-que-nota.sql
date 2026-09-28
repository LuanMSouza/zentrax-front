-- Trava contra o tipo de erro achado na nota 810 (Rodrigo brasil): valor_abatido MAIOR que valor_inicial (pagou
-- mais do que a nota vale). NOT VALID: não mexe nem valida as linhas antigas (a 810 fica como está até alguém
-- decidir o que fazer com ela), mas passa a bloquear qualquer INSERT/UPDATE novo que tente criar esse mesmo erro
-- — proteção também contra bug futuro em qualquer caminho de pagamento, não só o que já foi corrigido em 26/09.
-- Aplicar em produção com:  psql "$DATABASE_URL" -f prisma/manual/2026-09-28-trava-pagamento-maior-que-nota.sql
ALTER TABLE pedidos ADD CONSTRAINT pedidos_abatido_nao_excede_inicial
    CHECK (valor_abatido <= valor_inicial) NOT VALID;
