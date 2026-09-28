const { SHIPPING_LIMIT, SHIPPING_FREE_LIMIT, SHIPPING_AMOUNT } = require('../config/shippingConfig');

/**
 * Decide si un pedido lleva flete a partir de sus order_details YA PERSISTIDOS.
 * No recalcula impuestos: usa tax_amount tal como quedo guardado por linea.
 * @param {Array<{quantity: number|string, unit_price: number|string, tax_amount: number|string}>} orderDetails
 * @returns {number} 0 o SHIPPING_AMOUNT (10000)
 */
function calculateOrderShipping(orderDetails) {
  const subtotal = orderDetails.reduce(
    (sum, d) => sum + (parseFloat(d.unit_price) || 0) * (parseInt(d.quantity, 10) || 0),
    0
  );
  const totalTaxes = orderDetails.reduce(
    (sum, d) => sum + (parseFloat(d.tax_amount) || 0),
    0
  );
  const subtotalWithTaxes = subtotal + totalTaxes;

  if (subtotalWithTaxes < SHIPPING_LIMIT || subtotalWithTaxes >= SHIPPING_FREE_LIMIT) {
    return 0;
  }
  return SHIPPING_AMOUNT;
}

module.exports = { calculateOrderShipping };
