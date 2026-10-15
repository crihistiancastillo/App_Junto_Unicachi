"""Acceso a datos del servicio de ML.

Lee el historial desde PostgreSQL (tabla historial_demanda). Si no hay
DATABASE_URL o la conexión falla, usa un historial sintético para que el
servicio funcione en desarrollo sin base de datos.
"""
from __future__ import annotations

import logging
import os

import pandas as pd

from .demand import Prediccion, synthetic_history

log = logging.getLogger("junto.ml")
DATABASE_URL = os.getenv("DATABASE_URL")


def _connect():
    import psycopg  # import diferido: no es necesario en modo sintético
    return psycopg.connect(DATABASE_URL)


def load_history() -> pd.DataFrame:
    if DATABASE_URL:
        try:
            with _connect() as conn:
                return pd.read_sql(
                    "SELECT zona_id::text, producto_id::text, semana, cantidad FROM historial_demanda",
                    conn,
                )
        except Exception as exc:  # noqa: BLE001
            log.warning("No se pudo leer historial_demanda (%s); usando datos sintéticos.", exc)
    return synthetic_history(["zona-demo-1", "zona-demo-2"], ["prod-demo-1", "prod-demo-2", "prod-demo-3"])


def save_predictions(preds: list[Prediccion], model_version: str) -> int:
    if not DATABASE_URL or not preds:
        return 0
    try:
        with _connect() as conn, conn.cursor() as cur:
            cur.executemany(
                """INSERT INTO prediccion_demanda
                     (zona_id, producto_id, periodo, cantidad_estimada, confianza, modelo_version)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   ON CONFLICT (zona_id, producto_id, periodo) DO UPDATE SET
                     cantidad_estimada = EXCLUDED.cantidad_estimada,
                     confianza = EXCLUDED.confianza,
                     modelo_version = EXCLUDED.modelo_version,
                     generada = now()""",
                [(p.zona_id, p.producto_id, p.periodo, p.cantidad_estimada, p.confianza, model_version)
                 for p in preds],
            )
            return len(preds)
    except Exception as exc:  # noqa: BLE001
        log.warning("No se pudieron guardar las predicciones: %s", exc)
        return 0
