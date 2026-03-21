DROP INDEX IF EXISTS idx_comanda_precontas_comanda;
DROP TABLE IF EXISTS comanda_precontas;

DROP INDEX IF EXISTS idx_comanda_payments_comanda;
DROP TABLE IF EXISTS comanda_payments;

DROP INDEX IF EXISTS idx_comanda_items_batch;
DROP INDEX IF EXISTS idx_comanda_items_comanda_status;
DROP TABLE IF EXISTS comanda_items;

DROP INDEX IF EXISTS idx_comandas_mesa_status;
DROP INDEX IF EXISTS idx_comandas_numero;
DROP INDEX IF EXISTS idx_comandas_status_opened;
DROP TABLE IF EXISTS comandas;
