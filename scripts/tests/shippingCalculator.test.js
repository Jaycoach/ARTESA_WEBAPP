const assert = require('assert');
const { calculateOrderShipping } = require('../../src/utils/shippingCalculator');

function run() {
  // Cada caso usa order_details con tax_amount YA PERSISTIDO (nunca recalculado aqui).

  // 49.999 con impuestos (producto exento, tax_amount=0) -> sin flete
  assert.strictEqual(
    calculateOrderShipping([{ quantity: 1, unit_price: 49999, tax_amount: 0 }]),
    0, '49.999 con impuestos debe ser sin flete'
  );

  // 50.000 con impuestos (producto exento) -> flete $10.000
  assert.strictEqual(
    calculateOrderShipping([{ quantity: 1, unit_price: 50000, tax_amount: 0 }]),
    10000, '50.000 con impuestos debe cobrar flete'
  );

  // 79.999 con impuestos (producto exento) -> todavia cobra flete
  assert.strictEqual(
    calculateOrderShipping([{ quantity: 1, unit_price: 79999, tax_amount: 0 }]),
    10000, '79.999 con impuestos debe cobrar flete'
  );

  // 80.000 con impuestos (producto exento) -> envio gratis
  assert.strictEqual(
    calculateOrderShipping([{ quantity: 1, unit_price: 80000, tax_amount: 0 }]),
    0, '80.000 con impuestos debe ser gratis'
  );

  // Producto con IMSB+IVA (39% real, ya persistido en tax_amount): subtotal sin impuestos 60.000,
  // con impuestos 60.000 + 23.400 = 83.400 -> GRATIS, aunque 60.000 este muy por debajo de 80.000.
  // Confirma que se usa el impuesto REAL persistido, no el subtotal desnudo ni una tasa plana.
  assert.strictEqual(
    calculateOrderShipping([{ quantity: 1, unit_price: 60000, tax_amount: 23400 }]),
    0, 'con impuesto real IMSB+IVA debe quedar en tramo gratis'
  );

  // Pedido con varias lineas mixtas (exento + gravado): 40.000 exento + 8.000 con 19% = 9.520
  // -> 49.520 con impuestos -> SIN flete (justo debajo del limite)
  assert.strictEqual(
    calculateOrderShipping([
      { quantity: 2, unit_price: 20000, tax_amount: 0 },
      { quantity: 1, unit_price: 8000, tax_amount: 1520 }
    ]),
    0, 'multi-linea: 49.520 con impuestos, debe estar SIN flete'
  );

  console.log('shippingCalculator.test.js: OK');
}

run();
