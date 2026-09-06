-- Catálogo de códigos de impuesto sincronizado desde SAP B1 Service Layer
-- (SalesTaxCodes / OSTC + SalesTaxCodes_Lines -> SalesTaxAuthorities)
-- Ref. unificación de IVA (20250207-01)

CREATE TABLE IF NOT EXISTS tax_codes (
  code            VARCHAR(20)  PRIMARY KEY,          -- SalesTaxCodes.Code (ej. 'IMSB+IVA', 'IVAG01', 'IVAG03', 'IMCS')
  name            VARCHAR(100) NOT NULL,              -- SalesTaxCodes.Name
  total_rate      NUMERIC(6,4) NOT NULL,               -- SalesTaxCodes.Rate / 100 (informativo; suma de componentes)
  is_composite    BOOLEAN      NOT NULL DEFAULT FALSE, -- true si tiene más de un componente en tax_code_components
  active          BOOLEAN      NOT NULL DEFAULT TRUE,  -- SalesTaxCodes.Inactive == 'tNO'
  sap_raw_payload JSONB,                                -- payload crudo de SalesTaxCodes, para auditoría/debug
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tax_code_components (
  id             SERIAL       PRIMARY KEY,
  tax_code       VARCHAR(20)  NOT NULL REFERENCES tax_codes(code) ON DELETE CASCADE,
  component_code VARCHAR(20)  NOT NULL,   -- SalesTaxCodes_Lines.STACode (= SalesTaxAuthorities.Code)
  component_name VARCHAR(100),             -- SalesTaxAuthorities.Name (cacheado)
  category       VARCHAR(30)  NOT NULL DEFAULT 'OTRO', -- 'IVA' | 'IMPUESTO_SALUDABLE' | 'OTRO' — clasificación para agrupar en UI/reportes
  rate           NUMERIC(6,4) NOT NULL,   -- SalesTaxCodes_Lines.EffectiveRate / 100
  row_number     SMALLINT     NOT NULL DEFAULT 0,
  UNIQUE (tax_code, component_code)
);

CREATE INDEX IF NOT EXISTS idx_tax_code_components_tax_code ON tax_code_components (tax_code);

COMMENT ON TABLE tax_codes IS 'Catálogo de SalesTaxCodes (OSTC) sincronizado desde SAP B1. Fuente de verdad para el cálculo de impuestos en la app (reemplaza reglas hardcodeadas).';
COMMENT ON TABLE tax_code_components IS 'Componentes (SalesTaxAuthorities) de cada tax_code. Un código simple tiene 1 fila; un código compuesto como IMSB+IVA tiene N filas.';
