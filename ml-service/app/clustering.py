"""Agrupación de pedidos grupales compatibles (agruparPedidosCompatibles).

Dos pedidos son compatibles si van al mismo mayorista, sus zonas están
cerca y cierran en fechas parecidas: así el mayorista puede despacharlos en
una sola ruta y el volumen combinado alcanza un tramo de descuento mayor.

Se usa DBSCAN con una matriz de distancias precomputada que combina ambas
dimensiones: d = max(km / radio_km, |Δdías| / ventana_dias). Con eps = 1,
dos pedidos son vecinos solo si cumplen los dos criterios a la vez.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime

import numpy as np
from sklearn.cluster import DBSCAN

EARTH_RADIUS_KM = 6371.0


@dataclass
class PedidoEntrada:
    id: str
    mayorista_id: str
    zona_id: str
    latitud: float
    longitud: float
    fecha_cierre: datetime
    unidades: int
    productos: list[str] = field(default_factory=list)


@dataclass
class Grupo:
    cluster_id: int
    mayorista_id: str
    pedido_ids: list[str]
    zonas: list[str]
    total_unidades: int
    productos: list[str]


def haversine_matrix(lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    lat, lon = np.radians(lat), np.radians(lon)
    dlat = lat[:, None] - lat[None, :]
    dlon = lon[:, None] - lon[None, :]
    a = np.sin(dlat / 2) ** 2 + np.cos(lat[:, None]) * np.cos(lat[None, :]) * np.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def agrupar(pedidos: list[PedidoEntrada], radio_km: float = 5.0,
            ventana_dias: float = 3.0) -> list[Grupo]:
    por_mayorista: dict[str, list[PedidoEntrada]] = defaultdict(list)
    for p in pedidos:
        por_mayorista[p.mayorista_id].append(p)

    grupos: list[Grupo] = []
    next_id = 0
    for mayorista_id, items in por_mayorista.items():
        lat = np.array([p.latitud for p in items])
        lon = np.array([p.longitud for p in items])
        dias = np.array([p.fecha_cierre.timestamp() / 86400 for p in items])
        dist = np.maximum(haversine_matrix(lat, lon) / radio_km,
                          np.abs(dias[:, None] - dias[None, :]) / ventana_dias)
        labels = DBSCAN(eps=1.0, min_samples=1, metric="precomputed").fit_predict(dist)

        for label in sorted(set(labels)):
            miembros = [p for p, l in zip(items, labels) if l == label]
            grupos.append(Grupo(
                cluster_id=next_id,
                mayorista_id=mayorista_id,
                pedido_ids=[p.id for p in miembros],
                zonas=sorted({p.zona_id for p in miembros}),
                total_unidades=sum(p.unidades for p in miembros),
                productos=sorted({prod for p in miembros for prod in p.productos}),
            ))
            next_id += 1
    return grupos
