from datetime import datetime, timedelta

from app.clustering import PedidoEntrada, agrupar
from app.demand import DemandModel, synthetic_history


def test_forecast_returns_one_prediction_per_series_and_week():
    hist = synthetic_history(["z1", "z2"], ["p1", "p2", "p3"], weeks=26)
    model = DemandModel().fit(hist)
    preds = model.forecast(hist, horizon=2)
    assert len(preds) == 2 * 3 * 2
    assert all(p.cantidad_estimada >= 0 for p in preds)
    assert 0.05 <= model.confidence() <= 0.99
    # la confianza baja con el horizonte
    semana1 = [p for p in preds if p.periodo == min(q.periodo for q in preds)]
    semana2 = [p for p in preds if p.periodo == max(q.periodo for q in preds)]
    assert semana2[0].confianza < semana1[0].confianza


def test_forecast_filters_by_zone_and_is_close_to_recent_level():
    hist = synthetic_history(["z1", "z2"], ["p1"], weeks=26)
    model = DemandModel().fit(hist)
    preds = model.forecast(hist, horizon=1, zona_id="z2")
    assert {p.zona_id for p in preds} == {"z2"}
    reciente = hist[hist.zona_id == "z2"].sort_values("semana").cantidad.tail(4).mean()
    assert abs(preds[0].cantidad_estimada - reciente) / reciente < 0.35


def test_clustering_joins_nearby_orders_and_separates_far_ones():
    now = datetime(2026, 10, 12, 18)
    pedidos = [
        # Surquillo y Lince (~3.6 km), mismo mayorista, cierran el mismo día -> juntos
        PedidoEntrada("a", "sol", "surquillo", -12.1128, -77.0186, now, 36, ["aceite"]),
        PedidoEntrada("b", "sol", "lince", -12.0846, -77.0359, now + timedelta(hours=1), 28, ["aceite"]),
        # Mismo mayorista pero en Ate (~13 km) -> otro grupo
        PedidoEntrada("c", "sol", "ate", -12.0262, -76.9208, now, 20, ["arroz"]),
        # Cerca, pero cierra 6 días después -> otro grupo
        PedidoEntrada("d", "sol", "surquillo", -12.1128, -77.0186, now + timedelta(days=6), 10, ["aceite"]),
        # Otro mayorista nunca se mezcla
        PedidoEntrada("e", "agro", "surquillo", -12.1128, -77.0186, now, 41, ["papa"]),
    ]
    grupos = agrupar(pedidos)
    by_order = {pid: g.cluster_id for g in grupos for pid in g.pedido_ids}
    assert by_order["a"] == by_order["b"]
    assert len({by_order["a"], by_order["c"], by_order["d"], by_order["e"]}) == 4
    junto = next(g for g in grupos if "a" in g.pedido_ids)
    assert junto.total_unidades == 64
