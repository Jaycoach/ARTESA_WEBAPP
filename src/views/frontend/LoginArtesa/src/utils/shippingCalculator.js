export const MIN_ORDER_AMOUNT = 50000;
export const SHIPPING_LIMIT = 50000;
export const SHIPPING_FREE_LIMIT = 80000;
export const SHIPPING_AMOUNT = 10000;

/**
 * Calcula el flete a mostrar en el portal. El backend recalcula esto mismo al
 * transmitir el pedido a SAP (ver src/utils/shippingCalculator.js del backend) --
 * este calculo del frontend es solo para mostrar el valor antes de confirmar el pedido.
 * @param {number} subtotal - subtotal sin impuestos
 * @param {number} totalTaxes - impuestos reales de los productos del pedido
 * @returns {number} 0 o SHIPPING_AMOUNT (10000)
 */
export const calculateShipping = (subtotal, totalTaxes) => {
  const subtotalWithTaxes = subtotal + totalTaxes;
  if (subtotalWithTaxes < SHIPPING_LIMIT || subtotalWithTaxes >= SHIPPING_FREE_LIMIT) {
    return 0;
  }
  return SHIPPING_AMOUNT;
};
