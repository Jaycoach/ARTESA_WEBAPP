import assert from 'assert';
import { MIN_ORDER_AMOUNT, calculateShipping } from './shippingCalculator.js';

// Minimo del pedido: contra el subtotal SIN impuestos (validado por cada formulario
// antes de llamar a calculateShipping -- aqui se prueba solo la constante compartida).
assert.strictEqual(MIN_ORDER_AMOUNT, 50000);

// Flete: contra el subtotal CON impuestos (aqui subtotal+totalTaxes, con totalTaxes=0
// para probar los bordes exactos en numeros redondos).
assert.strictEqual(calculateShipping(49999, 0), 0, '49.999 con impuestos: sin flete (debajo del limite)');
assert.strictEqual(calculateShipping(50000, 0), 10000, '50.000 con impuestos: cobra flete');
assert.strictEqual(calculateShipping(79999, 0), 10000, '79.999 con impuestos: todavia cobra flete');
assert.strictEqual(calculateShipping(80000, 0), 0, '80.000 con impuestos: envio gratis');
assert.strictEqual(calculateShipping(40000, 0), 0, '40.000 con impuestos: sin flete');

// Impuesto real por linea, no una tasa plana: subtotal 60.000 sin impuestos, con impuesto
// real (39% IMSB+IVA) queda en 83.400 -> gratis.
assert.strictEqual(calculateShipping(60000, 60000 * 0.39), 0, 'con impuesto real IMSB+IVA debe quedar en tramo gratis');

// eslint-disable-next-line no-console
console.log('shippingCalculator.test.js (frontend): OK');
