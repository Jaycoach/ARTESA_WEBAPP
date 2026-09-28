ALTER TABLE orders ADD COLUMN IF NOT EXISTS sap_shipping_amount NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sap_shipping_expense_code INTEGER;
