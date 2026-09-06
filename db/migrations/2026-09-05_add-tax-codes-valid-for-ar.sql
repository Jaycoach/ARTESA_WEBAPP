-- Distingue códigos de impuesto válidos para ventas (ValidForAR de SAP SalesTaxCodes) de los que
-- son solo de compras — necesario porque un código con total_rate = 0 no necesariamente es válido
-- para transacciones de venta (ej. IVAD05 en PRUEBAS_ARTESA_14JUL, confirmado con SAP rechazando
-- una OV de prueba: "Enter tax code subject to sales postings").
ALTER TABLE tax_codes ADD COLUMN IF NOT EXISTS valid_for_ar BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN tax_codes.valid_for_ar IS 'SalesTaxCodes.ValidForAR de SAP == tYES. Usado para filtrar candidatos válidos al resolver dinámicamente un código de tasa 0% para transmitir órdenes sin tax_code_ar a SAP.';
