import assert from "node:assert/strict";
import { test } from "node:test";
import { assertTransicion, progreso, puedeTransicionar } from "../src/domain/orderState.ts";

test("sigue el ciclo de vida feliz del pedido", () => {
  const camino = ["ABIERTO", "CERRADO", "CONSOLIDADO", "OFERTA_ACEPTADA", "PAGADO", "EN_REPARTO", "ENTREGADO"] as const;
  for (let i = 1; i < camino.length; i++) assert.ok(puedeTransicionar(camino[i - 1], camino[i]));
});

test("impide saltos inválidos", () => {
  assert.equal(puedeTransicionar("ABIERTO", "PAGADO"), false);
  assert.equal(puedeTransicionar("ENTREGADO", "CANCELADO"), false);
  assert.throws(() => assertTransicion("PAGADO", "CANCELADO"), /no puede pasar/);
});

test("progreso usa la meta mientras está abierto", () => {
  assert.equal(progreso("ABIERTO", 41, 50), 82);
  assert.equal(progreso("ABIERTO", 80, 50), 100);
  assert.equal(progreso("EN_REPARTO", 10, 50), 100);
});
