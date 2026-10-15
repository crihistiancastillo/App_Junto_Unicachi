"""Servicio de ML de Junto (Python + FastAPI + scikit-learn).

Solo lo consume la API de Node.js (red interna), protegido con una clave
compartida en la cabecera X-Internal-Key.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime
from threading import Lock

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from . import data
from .clustering import PedidoEntrada, agrupar
from .demand import MODEL_VERSION, DemandModel

logging.basicConfig(level=logging.INFO)
INTERNAL_KEY = os.getenv("ML_INTERNAL_KEY", "dev-internal-key")

app = FastAPI(title="Junto ML", version="1.0.0")
_model: DemandModel | None = None
_lock = Lock()


def require_key(x_internal_key: str = Header(default="")) -> None:
    if x_internal_key != INTERNAL_KEY:
        raise HTTPException(status_code=401, detail="Clave interna inválida")


def get_model() -> DemandModel:
    global _model
    with _lock:
        if _model is None:
            _model = DemandModel().fit(data.load_history())
        return _model


# ---------- Esquemas ------------------------------------------------------
class PrediccionIn(BaseModel):
    zona_id: str | None = None
    horizonte_semanas: int = Field(default=1, ge=1, le=8)
    guardar: bool = True


class PedidoIn(BaseModel):
    id: str
    mayorista_id: str
    zona_id: str
    latitud: float
    longitud: float
    fecha_cierre: datetime
    unidades: int = Field(ge=0)
    productos: list[str] = []


class AgruparIn(BaseModel):
    pedidos: list[PedidoIn]
    radio_km: float = Field(default=5.0, gt=0)
    ventana_dias: float = Field(default=3.0, gt=0)


# ---------- Endpoints -----------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {"ok": True, "modelo": MODEL_VERSION, "entrenado": _model is not None}


@app.post("/demanda/entrenar", dependencies=[Depends(require_key)])
def entrenar() -> dict:
    global _model
    with _lock:
        _model = DemandModel().fit(data.load_history())
    return {"modelo": MODEL_VERSION, "mape_validacion": _model.mape, "confianza": _model.confidence()}


@app.post("/demanda/predecir", dependencies=[Depends(require_key)])
def predecir(body: PrediccionIn) -> dict:
    model = get_model()
    history = data.load_history()
    preds = model.forecast(history, horizon=body.horizonte_semanas, zona_id=body.zona_id)
    guardadas = data.save_predictions(preds, MODEL_VERSION) if body.guardar else 0
    return {
        "modelo": MODEL_VERSION,
        "guardadas": guardadas,
        "predicciones": [
            {"zona_id": p.zona_id, "producto_id": p.producto_id, "periodo": p.periodo.isoformat(),
             "cantidad_estimada": p.cantidad_estimada, "confianza": p.confianza}
            for p in preds
        ],
    }


@app.post("/pedidos/agrupar", dependencies=[Depends(require_key)])
def agrupar_pedidos(body: AgruparIn) -> dict:
    grupos = agrupar([PedidoEntrada(**p.model_dump()) for p in body.pedidos],
                     radio_km=body.radio_km, ventana_dias=body.ventana_dias)
    return {"grupos": [g.__dict__ for g in grupos]}
