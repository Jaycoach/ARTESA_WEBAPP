-- Mapeo admin BackOffice → vendedor SAP (SalesPersons.SalesEmployeeCode).
-- Ref. feature/backoffice-module, Fase 3 (transmisión de SalesPersonCode a SAP).
-- NO aplicar contra producción sin aprobación explícita.
--
-- Confirmado contra el Service Layer real de staging (PRUEBAS_ARTESA_14JUL):
-- el campo en el recurso Orders (EntityType Document) es SalesPersonCode (Edm.Int32),
-- NO SlpCode (ese nombre devuelve 400 "Property 'SlpCode' of 'Document' is invalid").
-- Ver docs/CHANGELOG-backoffice.md, Fase 3, para la evidencia completa.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sap_sales_employee_code INTEGER NULL;

COMMENT ON COLUMN users.sap_sales_employee_code IS
  'SalesPersons.SalesEmployeeCode de SAP B1 asociado a este usuario (solo aplica a admins BackOffice). NULL = sin mapeo; en ese caso las órdenes creadas por BackOffice no envían SalesPersonCode a SAP (se omite el campo, no se asume -1).';
