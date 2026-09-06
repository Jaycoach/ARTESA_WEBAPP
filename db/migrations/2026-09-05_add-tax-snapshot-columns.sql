-- Snapshot de impuesto por línea de orden (order_details) y agregados por orden (orders)
-- Ref. unificación de IVA (20250207-01)
--
-- IMPORTANTE: estas columnas se llenan UNA SOLA VEZ al crear la orden (snapshot), nunca se
-- recalculan por JOIN en vivo contra products.tax_code_ar. Si SAP cambia el tax_code_ar de un
-- producto después, las órdenes ya creadas conservan el desglose que tenían al momento de la compra.

ALTER TABLE order_details ADD COLUMN IF NOT EXISTS tax_code_ar VARCHAR;
ALTER TABLE order_details ADD COLUMN IF NOT EXISTS iva_amount NUMERIC DEFAULT 0;
ALTER TABLE order_details ADD COLUMN IF NOT EXISTS impuesto_saludable_amount NUMERIC DEFAULT 0;
ALTER TABLE order_details ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS iva_amount NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS impuesto_saludable_amount NUMERIC DEFAULT 0;

COMMENT ON COLUMN order_details.tax_code_ar IS 'Snapshot de products.tax_code_ar al momento de crear la orden. No se actualiza retroactivamente.';
COMMENT ON COLUMN order_details.tax_amount IS 'Snapshot: iva_amount + impuesto_saludable_amount + otras categorías (ej. OTRO/IMCS) de esta línea.';
COMMENT ON COLUMN orders.iva_amount IS 'Agregado de order_details.iva_amount de todas las líneas, calculado una sola vez al crear la orden.';
COMMENT ON COLUMN orders.impuesto_saludable_amount IS 'Agregado de order_details.impuesto_saludable_amount de todas las líneas, calculado una sola vez al crear la orden.';
