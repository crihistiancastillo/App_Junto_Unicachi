import assert from "node:assert/strict";
import { test } from "node:test";
import { consolidar, descuentoPara, precioPara, siguienteTramo, type Tramo } from "../src/domain/pricing.ts";

// Tramos reales de la base demo: papa Canchán (S/ 95 el saco)
const papa: Tramo[] = [
  { cantidad_minima: 10, cantidad_maxima: 24, porcentaje: 10 },
  { cantidad_minima: 25, cantidad_maxima: 49, porcentaje: 18 },
  { cantidad_minima: 50, cantidad_maxima: null, porcentaje: 28 },
];

test("aplica el tramo correcto según la cantidad", () => {
  assert.equal(descuentoPara(papa, 5), 0);
  assert.equal(descuentoPara(papa, 10), 10);
  assert.equal(descuentoPara(papa, 49), 18);
  assert.equal(descuentoPara(papa, 50), 28);
  assert.equal(descuentoPara(papa, 500), 28);
});

test("precioPara reproduce el precio del prototipo (S/ 95 → S/ 68.40)", () => {
  assert.equal(precioPara(95, papa, 50), 68.4);
});

test("ignora tramos fuera de vigencia", () => {
  const vencido: Tramo[] = [{ cantidad_minima: 1, cantidad_maxima: null, porcentaje: 50, vigente_hasta: "2020-01-01" }];
  assert.equal(descuentoPara(vencido, 10, new Date("2026-10-12")), 0);
});

test("siguienteTramo indica cuánto falta para el próximo descuento", () => {
  assert.deepEqual(siguienteTramo(papa, 41), { faltan: 9, porcentaje: 28 });
  assert.equal(siguienteTramo(papa, 60), null);
});

test("consolidar suma volúmenes de varios pedidos y aplica el tramo combinado", () => {
  const aceite: Tramo[] = [
    { cantidad_minima: 20, cantidad_maxima: 59, porcentaje: 4 },
    { cantidad_minima: 60, cantidad_maxima: null, porcentaje: 7 },
  ];
  const id = "aceite";
  // Surquillo pidió 36 y Lince 28: por separado obtendrían 4 %, juntos 64 → 7 %
  const r = consolidar(
    [
      { producto_id: id, cantidad: 36, precio_lista: 230 },
      { producto_id: id, cantidad: 28, precio_lista: 230 },
    ],
    { [id]: aceite },
  );
  assert.equal(r.total_unidades, 64);
  assert.equal(r.monto_bruto, 14720);
  assert.equal(r.detalle[0].porcentaje, 7);
  assert.equal(r.detalle[0].precio_final, 213.9);
  assert.equal(r.monto_neto, 13689.6);
  assert.equal(r.porcentaje_descuento, 7);
});

test("consolidar con varios productos calcula el % ponderado", () => {
  const r = consolidar(
    [
      { producto_id: "a", cantidad: 50, precio_lista: 100 }, // 28 % → 3600
      { producto_id: "b", cantidad: 5, precio_lista: 100 },  // sin tramo → 500
    ],
    { a: papa, b: papa },
  );
  assert.equal(r.monto_bruto, 5500);
  assert.equal(r.monto_neto, 4100);
  assert.equal(r.porcentaje_descuento, 25.45);
});
