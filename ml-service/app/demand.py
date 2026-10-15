"""Predicción de demanda agregada por zona y producto (ServicioPrediccion).

Modelo global de regresión (GradientBoostingRegressor) entrenado sobre el
historial semanal de todas las series zona × producto. Cada fila usa como
variables la demanda rezagada (1, 2 y 4 semanas), la media móvil de 4
semanas, la estacionalidad anual (seno/coseno) y la identidad de la serie.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_percentage_error

MODEL_VERSION = "gbr-v1"
LAGS = (1, 2, 4)
MIN_WEEKS = 8


@dataclass
class Prediccion:
    zona_id: str
    producto_id: str
    periodo: date
    cantidad_estimada: int
    confianza: float


def _seasonality(weeks: pd.Series) -> tuple[pd.Series, pd.Series]:
    angle = 2 * np.pi * weeks / 52.0
    return np.sin(angle), np.cos(angle)


def build_features(history: pd.DataFrame) -> pd.DataFrame:
    """Agrega columnas de rezagos y estacionalidad a un historial semanal.

    `history` debe tener: zona_id, producto_id, semana (date), cantidad.
    """
    df = history.copy()
    df["semana"] = pd.to_datetime(df["semana"])
    df = df.sort_values(["zona_id", "producto_id", "semana"])
    grouped = df.groupby(["zona_id", "producto_id"])["cantidad"]
    for lag in LAGS:
        df[f"lag_{lag}"] = grouped.shift(lag)
    df["media_4"] = grouped.transform(lambda s: s.shift(1).rolling(4).mean())
    df["sem_sin"], df["sem_cos"] = _seasonality(df["semana"].dt.isocalendar().week.astype(float))
    df["serie"] = (df["zona_id"].astype(str) + "|" + df["producto_id"].astype(str)).astype("category")
    df["serie_cod"] = df["serie"].cat.codes
    return df


FEATURES = [f"lag_{lag}" for lag in LAGS] + ["media_4", "sem_sin", "sem_cos", "serie_cod"]


class DemandModel:
    def __init__(self, random_state: int = 7) -> None:
        self.model = GradientBoostingRegressor(
            n_estimators=250, learning_rate=0.05, max_depth=3, random_state=random_state
        )
        self.mape: float | None = None
        self.trained = False

    def fit(self, history: pd.DataFrame) -> "DemandModel":
        weeks = history["semana"].nunique()
        if weeks < MIN_WEEKS:
            raise ValueError(f"Se necesitan al menos {MIN_WEEKS} semanas de historial (hay {weeks}).")
        data = build_features(history).dropna(subset=FEATURES)

        # Validación temporal: las últimas 4 semanas quedan fuera del entrenamiento.
        cutoff = data["semana"].max() - pd.Timedelta(weeks=4)
        train, test = data[data["semana"] <= cutoff], data[data["semana"] > cutoff]
        if len(test) and len(train):
            self.model.fit(train[FEATURES], train["cantidad"])
            pred = self.model.predict(test[FEATURES])
            self.mape = float(mean_absolute_percentage_error(test["cantidad"].clip(lower=1), pred))

        self.model.fit(data[FEATURES], data["cantidad"])
        self.trained = True
        return self

    def confidence(self) -> float:
        """Confianza = 1 − MAPE de validación, acotada a [0.05, 0.99]."""
        if self.mape is None:
            return 0.5
        return round(float(np.clip(1 - self.mape, 0.05, 0.99)), 3)

    def forecast(self, history: pd.DataFrame, horizon: int = 1,
                 zona_id: str | None = None) -> list[Prediccion]:
        """Pronóstico recursivo `horizon` semanas adelante para cada serie."""
        if not self.trained:
            raise RuntimeError("El modelo no está entrenado.")
        # Se pronostica sobre el historial completo para que los códigos de serie
        # coincidan con los del entrenamiento; el filtro por zona se aplica al final.
        full = history.copy()
        full["semana"] = pd.to_datetime(full["semana"]).dt.date

        results: list[Prediccion] = []
        conf = self.confidence()
        for step in range(1, horizon + 1):
            last_week = max(full["semana"])
            next_week = last_week + timedelta(weeks=1)
            series = full[["zona_id", "producto_id"]].drop_duplicates()
            future = series.assign(semana=next_week, cantidad=np.nan)
            frame = build_features(pd.concat([full, future], ignore_index=True))
            rows = frame[frame["semana"].dt.date == next_week]
            preds = np.clip(self.model.predict(rows[FEATURES].fillna(0)), 0, None).round().astype(int)
            new = rows[["zona_id", "producto_id"]].assign(semana=next_week, cantidad=preds)
            full = pd.concat([full, new], ignore_index=True)
            # La confianza decae con el horizonte del pronóstico.
            step_conf = round(conf * (0.93 ** (step - 1)), 3)
            for r in new.itertuples(index=False):
                if zona_id and str(r.zona_id) != str(zona_id):
                    continue
                results.append(Prediccion(str(r.zona_id), str(r.producto_id), next_week,
                                          int(r.cantidad), step_conf))
        return results


def synthetic_history(zonas: list[str], productos: list[str], weeks: int = 26,
                      seed: int = 42) -> pd.DataFrame:
    """Historial sintético para desarrollo cuando no hay base de datos."""
    rng = np.random.default_rng(seed)
    monday = date.today() - timedelta(days=date.today().weekday())
    rows = []
    for zi, z in enumerate(zonas):
        for pi, p in enumerate(productos):
            base = 25 + 6 * pi + 10 * zi
            for w in range(weeks, 0, -1):
                semana = monday - timedelta(weeks=w)
                season = 1 + 0.18 * np.sin(semana.isocalendar().week / 52 * 2 * np.pi)
                rows.append((z, p, semana, max(0, int(round(base * season * rng.uniform(0.85, 1.15))))))
    return pd.DataFrame(rows, columns=["zona_id", "producto_id", "semana", "cantidad"])
