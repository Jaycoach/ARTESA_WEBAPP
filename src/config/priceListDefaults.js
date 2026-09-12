/**
 * Fallback único para price_list_code/price_list cuando SAP no reporta PriceListNum
 * o la lista reportada no existe/está activa en SAP. Usado por SapClientService,
 * Order.js, branchAuthController y branchOrderController — una sola fuente de verdad
 * para evitar el patrón de fallbacks divergentes ('1' vs 'ESTANDAR' vs 'BRONCE')
 * que causó el incidente 2026-09-08 (94% de clientes en staging colapsados a '1').
 */
module.exports = {
  DEFAULT_PRICE_LIST_CODE: '1'
};
