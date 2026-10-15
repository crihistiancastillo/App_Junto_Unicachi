-- =====================================================================
-- Datos DEMO (tomados del prototipo de Figma Make: Rosa Mendoza,
-- Distribuidora Sol, AgroAndes, UNICACHI, etc.)
-- Los UUID son fijos para que la app móvil pueda usar el "modo demo".
-- =====================================================================
SELECT setseed(0.42);

-- ---------- Zonas (en la app se muestran como "comunidades") ------------
INSERT INTO zona (id, nombre, distrito, latitud, longitud, radio_km) VALUES
 ('11111111-0000-0000-0000-000000000001', 'UNICACHI · Puestos', 'Los Olivos',   -11.9950, -77.0710, 1.2),
 ('11111111-0000-0000-0000-000000000002', 'UNICACHI · Frutas y verduras', 'Comas', -11.9400, -77.0550, 2.0),
 ('11111111-0000-0000-0000-000000000003', 'UNICACHI · Bodegas', 'San Martín de Porres', -11.9990, -77.0960, 1.5);

-- ---------- Usuarios -----------------------------------------------------
INSERT INTO usuario (id, nombre, email, telefono, rol) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001', 'Equipo Junto',   'admin@junto.pe',              '+51 900 000 001', 'ADMINISTRADOR'),
 ('cccccccc-0000-0000-0000-000000000001', 'Rosa Mendoza',   'rosa@gmail.com',           '+51 987 654 321', 'COMERCIANTE'),
 ('cccccccc-0000-0000-0000-000000000002', 'Luis Quispe',    'luis@gmail.com',          '+51 986 111 222', 'COMERCIANTE'),
 ('cccccccc-0000-0000-0000-000000000003', 'Carmen Huamán',  'carmen@gmail.com',          '+51 985 333 444', 'COMERCIANTE'),
 ('cccccccc-0000-0000-0000-000000000004', 'José Torres',    'jose@gmail.com',        '+51 984 555 666', 'COMERCIANTE'),
 ('cccccccc-0000-0000-0000-000000000005', 'Ana Flores',     'ana@gmail.com',        '+51 983 777 888', 'COMERCIANTE'),
 ('cccccccc-0000-0000-0000-000000000006', 'Pedro Rojas',    'pedro@gmail.com',        '+51 982 999 000', 'COMERCIANTE'),
 ('dddddddd-0000-0000-0000-000000000001', 'Diego Salazar',  'ventas.distribuidorasol@gmail.com',  '+51 981 123 456', 'MAYORISTA'),
 ('dddddddd-0000-0000-0000-000000000002', 'Marta Ccori',    'ventas.agroandes@gmail.com',         '+51 980 654 321', 'MAYORISTA'),
 ('dddddddd-0000-0000-0000-000000000003', 'Julio Paredes',  'ventas.vallefresco@gmail.com',       '+51 979 222 333', 'MAYORISTA');

INSERT INTO comerciante (usuario_id, ruc, razon_social, nombre_comercial, tipo_negocio, direccion, latitud, longitud, zona_id) VALUES
 ('cccccccc-0000-0000-0000-000000000001', '10456789012', 'Rosa Mendoza Vargas',  'Abarrotes Rosita',  'PUESTO_MERCADO', 'UNICACHI, puesto 42 (abarrotes), Los Olivos', -11.9952, -77.0712, '11111111-0000-0000-0000-000000000001'),
 ('cccccccc-0000-0000-0000-000000000002', '10467890123', 'Luis Quispe Mamani',   'Bodega Don Luis',   'BODEGA',         'UNICACHI, puesto 12 (verduras), Los Olivos', -11.9948, -77.0708, '11111111-0000-0000-0000-000000000001'),
 ('cccccccc-0000-0000-0000-000000000003', '10478901234', 'Carmen Huamán Ríos',   'Puesto 17',         'PUESTO_MERCADO', 'UNICACHI, puesto 17 (carnes y pescados), Los Olivos', -11.995, -77.0715, '11111111-0000-0000-0000-000000000001'),
 ('cccccccc-0000-0000-0000-000000000004', '10489012345', 'José Torres León',     'Bodega Torres',     'BODEGA',         'UNICACHI, bodega 27 (bebidas y lácteos), Comas', -11.9402, -77.0548, '11111111-0000-0000-0000-000000000002'),
 ('cccccccc-0000-0000-0000-000000000005', '10490123456', 'Ana Flores Cárdenas',  'Minimarket Ana',    'BODEGA',         'UNICACHI, bodega 35 (abarrotes y limpieza), San Martín de Porres', -11.9992, -77.0958, '11111111-0000-0000-0000-000000000003'),
 ('cccccccc-0000-0000-0000-000000000006', '10401234567', 'Pedro Rojas Silva',    'Bodega Rojas',      'BODEGA',         'UNICACHI, bodega 41 (lácteos y huevos), San Martín de Porres', -11.9988, -77.0962, '11111111-0000-0000-0000-000000000003');

INSERT INTO mayorista (usuario_id, ruc, razon_social, direccion_almacen) VALUES
 ('dddddddd-0000-0000-0000-000000000001', '20123456789', 'Distribuidora Sol S.A.C.', 'Av. Túpac Amaru 1450, Comas'),
 ('dddddddd-0000-0000-0000-000000000002', '20234567891', 'AgroAndes E.I.R.L.',       'Av. Carlos Izaguirre 300, Los Olivos'),
 ('dddddddd-0000-0000-0000-000000000003', '20345678912', 'Valle Fresco S.A.C.',      'Jr. Los Pinos 220, San Martín de Porres');

INSERT INTO consentimiento_datos (usuario_id, finalidad, version_politica)
SELECT id, 'Gestión de compras colectivas y notificaciones', '2026.1' FROM usuario;

-- ---------- Catálogo y descuentos por volumen ---------------------------
INSERT INTO producto (id, mayorista_id, sku, nombre, categoria, unidad_medida, precio_unitario, stock, imagen_url) VALUES
 ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'PAP-CAN-50', 'Papa Canchán seleccionada', 'Frutas y verduras', 'saco 50 kg',  95.00, 400, 'local:papa-canchan'),
 ('eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000003', 'NAR-VAL-25', 'Naranja Valencia jugosa',   'Frutas y verduras', 'jaba 25 kg',  78.00, 250, 'local:naranja-valencia'),
 ('eeeeeeee-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000002', 'CEB-ROJ-50', 'Cebolla roja premium',      'Frutas y verduras', 'malla 50 kg', 132.00, 300, 'https://images.unsplash.com/photo-1678294076687-adbfd71176e8?auto=format&fit=crop&w=900&q=85'),
 ('eeeeeeee-0000-0000-0000-000000000004', 'dddddddd-0000-0000-0000-000000000001', 'ACE-VEG-12', 'Aceite vegetal x 12',       'Abarrotes',         'caja 12 × 1 L', 230.00, 500, 'local:aceite-primor'),
 ('eeeeeeee-0000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-000000000001', 'ARR-SUP-50', 'Arroz superior',            'Abarrotes',         'saco 50 kg', 128.00, 600, NULL),
 ('eeeeeeee-0000-0000-0000-000000000006', 'dddddddd-0000-0000-0000-000000000001', 'AZU-RUB-50', 'Azúcar rubia nacional',     'Abarrotes',         'saco 50 kg', 108.00, 450, NULL),
 ('eeeeeeee-0000-0000-0000-000000000007', 'dddddddd-0000-0000-0000-000000000001', 'LEC-EVA-24', 'Leche evaporada x 24',      'Lácteos y huevos',  'caja 24 latas', 96.00, 350, NULL);

INSERT INTO descuento_volumen (producto_id, cantidad_minima, cantidad_maxima, porcentaje) VALUES
 ('eeeeeeee-0000-0000-0000-000000000001', 10, 24,   10.00), ('eeeeeeee-0000-0000-0000-000000000001', 25, 49, 18.00), ('eeeeeeee-0000-0000-0000-000000000001', 50, NULL, 28.00),
 ('eeeeeeee-0000-0000-0000-000000000002', 10, 29,   12.00), ('eeeeeeee-0000-0000-0000-000000000002', 30, NULL, 30.00),
 ('eeeeeeee-0000-0000-0000-000000000003', 15, 39,   15.00), ('eeeeeeee-0000-0000-0000-000000000003', 40, NULL, 27.00),
 ('eeeeeeee-0000-0000-0000-000000000004', 20, 59,    4.00), ('eeeeeeee-0000-0000-0000-000000000004', 60, NULL,  7.00),
 ('eeeeeeee-0000-0000-0000-000000000005', 20, 49,    6.00), ('eeeeeeee-0000-0000-0000-000000000005', 50, NULL, 12.50),
 ('eeeeeeee-0000-0000-0000-000000000006', 20, 39,    6.00), ('eeeeeeee-0000-0000-0000-000000000006', 40, NULL, 13.00),
 ('eeeeeeee-0000-0000-0000-000000000007', 30, 79,    8.00), ('eeeeeeee-0000-0000-0000-000000000007', 80, NULL, 14.00);

-- ---------- Pedidos grupales abiertos (pantalla "Pedidos por completar") -
INSERT INTO pedido_grupal (id, codigo, creador_id, mayorista_id, zona_id, estado, meta_unidades, fecha_creacion, fecha_limite) VALUES
 ('ffffffff-0000-0000-0000-000000000001', 'JNT-0101', 'cccccccc-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'ABIERTO', 50, now() - interval '19 hours', now() + interval '5 hours'),
 ('ffffffff-0000-0000-0000-000000000002', 'JNT-0102', 'cccccccc-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'ABIERTO', 30, now() - interval '10 hours', now() + interval '1 day'),
 ('ffffffff-0000-0000-0000-000000000003', 'JNT-0103', 'cccccccc-0000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003', 'ABIERTO', 40, now() - interval '6 hours',  now() + interval '2 days');

INSERT INTO participacion (id, pedido_grupal_id, comerciante_id) VALUES
 ('99999999-0001-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001'),
 ('99999999-0001-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002'),
 ('99999999-0001-0000-0000-000000000003', 'ffffffff-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003'),
 ('99999999-0001-0000-0000-000000000004', 'ffffffff-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000004'),
 ('99999999-0002-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002'),
 ('99999999-0002-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003'),
 ('99999999-0003-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000005'),
 ('99999999-0003-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000006');

INSERT INTO item_pedido (participacion_id, producto_id, cantidad, precio_unitario) VALUES
 ('99999999-0001-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001',  8,  95.00),
 ('99999999-0001-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', 12,  95.00),
 ('99999999-0001-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000001', 10,  95.00),
 ('99999999-0001-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000001', 11,  95.00),
 ('99999999-0002-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000002', 10,  78.00),
 ('99999999-0002-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000002',  9,  78.00),
 ('99999999-0003-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000003', 10, 132.00),
 ('99999999-0003-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000003',  7, 132.00);

-- ---------- Pedidos cerrados listos para consolidar (demo del ML) --------
-- Dos pedidos de aceite de zonas vecinas: el clustering los junta y el
-- volumen combinado (64 cajas) alcanza el tramo de 7 % de descuento.
INSERT INTO pedido_grupal (id, codigo, creador_id, mayorista_id, zona_id, estado, meta_unidades, fecha_creacion, fecha_limite, fecha_cierre) VALUES
 ('ffffffff-0000-0000-0000-000000000004', 'JNT-0098', 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'CERRADO', 40, now() - interval '3 days', now() - interval '2 hours', now() - interval '2 hours'),
 ('ffffffff-0000-0000-0000-000000000005', 'JNT-0099', 'cccccccc-0000-0000-0000-000000000006', 'dddddddd-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', 'CERRADO', 30, now() - interval '2 days', now() - interval '1 hour',  now() - interval '1 hour');

INSERT INTO participacion (id, pedido_grupal_id, comerciante_id) VALUES
 ('99999999-0004-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000001'),
 ('99999999-0004-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000002'),
 ('99999999-0004-0000-0000-000000000003', 'ffffffff-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000004'),
 ('99999999-0005-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000005'),
 ('99999999-0005-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000006');

INSERT INTO item_pedido (participacion_id, producto_id, cantidad, precio_unitario) VALUES
 ('99999999-0004-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000004', 14, 230.00),
 ('99999999-0004-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000004', 12, 230.00),
 ('99999999-0004-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000004', 10, 230.00),
 ('99999999-0005-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000004', 16, 230.00),
 ('99999999-0005-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000004', 12, 230.00);

-- ---------- Pedido ya aceptado y en reparto (seguimiento + entregas) -----
INSERT INTO pedido_consolidado (id, mayorista_id, zona_id, total_unidades, monto_bruto, porcentaje_descuento, monto_neto, estado, fecha_consolidacion) VALUES
 ('bbbbbbbb-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 52, 6656.00, 12.50, 5824.00, 'ACEPTADO', now() - interval '2 days');

INSERT INTO pedido_grupal (id, codigo, creador_id, mayorista_id, zona_id, pedido_consolidado_id, estado, meta_unidades, fecha_creacion, fecha_limite, fecha_cierre) VALUES
 ('ffffffff-0000-0000-0000-000000000006', 'JNT-0091', 'cccccccc-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'EN_REPARTO', 50, now() - interval '5 days', now() - interval '3 days', now() - interval '3 days 4 hours');

INSERT INTO participacion (id, pedido_grupal_id, comerciante_id, subtotal, estado_pago) VALUES
 ('99999999-0006-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000001', 224.00, 'APROBADO'),
 ('99999999-0006-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000002', 2240.00, 'APROBADO'),
 ('99999999-0006-0000-0000-000000000003', 'ffffffff-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000003', 1680.00, 'APROBADO'),
 ('99999999-0006-0000-0000-000000000004', 'ffffffff-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000004', 1680.00, 'APROBADO');

INSERT INTO item_pedido (participacion_id, producto_id, cantidad, precio_unitario) VALUES
 ('99999999-0006-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000005',  2, 112.00),
 ('99999999-0006-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000005', 20, 112.00),
 ('99999999-0006-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000005', 15, 112.00),
 ('99999999-0006-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000005', 15, 112.00);

INSERT INTO oferta (pedido_consolidado_id, mayorista_id, porcentaje_descuento, monto_final, estado, fecha_respuesta) VALUES
 ('bbbbbbbb-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 12.50, 5824.00, 'ACEPTADA', now() - interval '2 days');

INSERT INTO pago (participacion_id, monto, metodo, estado, pasarela, id_transaccion_externa, fecha)
SELECT id, subtotal, 'YAPE', 'APROBADO', 'fake', 'demo_' || left(id::text, 8), now() - interval '1 day'
FROM participacion WHERE pedido_grupal_id = 'ffffffff-0000-0000-0000-000000000006';

INSERT INTO entrega (pedido_consolidado_id, fecha_programada, estado, direccion) VALUES
 ('bbbbbbbb-0000-0000-0000-000000000001', current_date, 'EN_CAMINO', 'UNICACHI, puerta principal');

-- ---------- Pedidos históricos entregados (para los indicadores) --------
INSERT INTO pedido_consolidado (id, mayorista_id, zona_id, total_unidades, monto_bruto, porcentaje_descuento, monto_neto, estado, fecha_consolidacion) VALUES
 ('bbbbbbbb-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 56, 5320.00, 28.00, 3830.40, 'ACEPTADO', now() - interval '20 days'),
 ('bbbbbbbb-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', 34, 2652.00, 30.00, 1856.40, 'ACEPTADO', now() - interval '12 days');

INSERT INTO pedido_grupal (codigo, creador_id, mayorista_id, zona_id, pedido_consolidado_id, estado, meta_unidades, fecha_creacion, fecha_limite, fecha_cierre) VALUES
 ('JNT-0071', 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'ENTREGADO', 50, now() - interval '23 days', now() - interval '21 days', now() - interval '21 days 6 hours'),
 ('JNT-0084', 'cccccccc-0000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000003', 'ENTREGADO', 30, now() - interval '14 days', now() - interval '13 days', now() - interval '13 days 2 hours');

-- ---------- Notificaciones de ejemplo -----------------------------------
INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, referencia) VALUES
 ('cccccccc-0000-0000-0000-000000000001', 'Tu arroz está en camino', 'Distribuidora Sol entrega hoy entre 2:00 y 4:00 p. m.', 'ENTREGA', 'ffffffff-0000-0000-0000-000000000006'),
 ('cccccccc-0000-0000-0000-000000000001', 'Faltan 9 sacos para la meta', 'El pedido de papa Canchán cierra en 5 horas.', 'PEDIDO', 'ffffffff-0000-0000-0000-000000000001');

-- ---------- Historial semanal sintético (26 semanas) para el modelo -----
-- Demanda base por producto × factor de zona × estacionalidad × ruido.
INSERT INTO historial_demanda (zona_id, producto_id, semana, cantidad)
SELECT z.id, p.id, s.semana,
       GREATEST(0, round(
         base.b * zf.f
         * (1 + 0.18 * sin(extract(week FROM s.semana) / 52.0 * 2 * pi()))
         * (0.85 + random() * 0.30)
       ))::int
FROM zona z
CROSS JOIN producto p
CROSS JOIN (SELECT (date_trunc('week', now()) - (n || ' weeks')::interval)::date AS semana
            FROM generate_series(1, 26) n) s
JOIN (VALUES ('PAP-CAN-50', 42), ('NAR-VAL-25', 26), ('CEB-ROJ-50', 30), ('ACE-VEG-12', 35),
             ('ARR-SUP-50', 48), ('AZU-RUB-50', 31), ('LEC-EVA-24', 40)) AS base(sku, b) ON base.sku = p.sku
JOIN (VALUES ('Los Olivos', 1.0), ('Comas', 1.6), ('San Martín de Porres', 0.7)) AS zf(distrito, f) ON zf.distrito = z.distrito;
