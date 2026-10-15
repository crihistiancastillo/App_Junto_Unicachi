# Junto · Mercado colectivo

Plataforma móvil de compras colectivas para bodegas y puestos de mercado: los comercios arman pedidos grupales por zona, el sistema consolida la demanda y el mayorista aplica descuentos por volumen sobre el total combinado.

## Arquitectura

| Carpeta | Tecnología | Responsabilidad |
|---|---|---|
| `mobile/` | React Native + Expo + TypeScript | App para comerciante, mayorista y administrador |
| `api/` | Node.js + Express + TypeScript | Lógica de negocio, autenticación, pagos, notificaciones |
| `ml-service/` | Python + FastAPI + scikit-learn | Predicción de demanda por zona y clustering de pedidos |
| `database/` | PostgreSQL 16 | Esquema y datos **demo** |

Servicios externos: **Firebase** (Auth y Cloud Messaging) y **Culqi** (pagos con tarjeta y Yape). Ambos son opcionales en modo demo.

## Puesta en marcha (sin Docker)

Requisitos: Node.js 20+, Android Studio con un emulador creado, y Expo Go (Expo lo instala solo en el emulador).

**Terminal 1: API** (desde la carpeta `junto`)

```powershell
cd api
npm install
npm run dev
```

La primera vez crea una base PostgreSQL embebida en `api/.junto-db` con todos los datos demo. Está lista cuando aparece `Junto API escuchando en :3000`. Comprueba en el navegador `http://localhost:3000/health`. Para reiniciar los datos demo, detén la API y borra la carpeta `api/.junto-db`.

**Terminal 2: app** (desde la carpeta `junto`)

```powershell
cd mobile
npm install --legacy-peer-deps
npx expo install expo@latest
npx expo install --fix
Copy-Item .env.example .env
npx expo start --android --go --localhost --clear
```

Si el emulador muestra `Failed to download remote update`, conecta los puertos con adb y vuelve a abrir:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb reverse tcp:8081 tcp:8081
```

Si aun así no conecta, usa `npx expo start --android --go --tunnel --clear`.

**Servicio de ML (opcional).** Sin él la app funciona igual: la consolidación agrupa por zona y la demanda sugerida queda vacía. Para activarlo: `cd ml-service`, `pip install -r requirements.txt`, `uvicorn app.main:app --port 8000`.

## Puesta en marcha con Docker

```bash
docker compose up --build   # PostgreSQL real + API + ML
```

Luego ejecuta solo la "Terminal 2" de arriba.

### Cuentas demo

En modo demo no se valida la contraseña (escribe cualquiera).

| Rol | Correo | Qué ver |
|---|---|---|
| Comerciante | `rosa@gmail.com` | Pedidos del sector Puestos, seguimiento del arroz en reparto |
| Comerciante | `pedro@gmail.com` | Sector Bodegas |
| Mayorista | `ventas.distribuidorasol@gmail.com` | Pedidos de aceite listos para consolidar |
| Mayorista | `ventas.agroandes@gmail.com` | Papa y cebolla |
| Administrador | `admin@junto.pe` | Indicadores, comercios y zonas |

## Recorrido sugerido para la demo

Este recorrido muestra el valor central del proyecto: dos zonas que por separado solo obtendrían 4 % de descuento consiguen 7 % comprando juntas.

1. Entra como **Distribuidora Sol** → pestaña *Pedidos* → **Consolidar pedidos cerrados**. El servicio de ML agrupa los pedidos de aceite de los sectores Puestos (36 cajas) y Bodegas (28 cajas) porque están a ~3.6 km y cierran el mismo día: 64 cajas alcanzan el tramo de 7 %.
2. Abre el consolidado y **acéptalo**. Los cinco comercios reciben la notificación para pagar su parte con el precio rebajado (S/ 213.90 en vez de S/ 230).
3. Cierra sesión y entra como **Rosa** → *Pedidos* → el aceite aparece como «Paga tu parte» → paga con Yape (celular que empiece con 9 y cualquier código de 6 dígitos). Una tarjeta terminada en `0002` simula un rechazo.
4. Como **Rosa**, en *Inicio* únete o ajusta el pedido de papa: la escalera de descuentos muestra cuánto falta para el 28 %.
5. Como **administrador**, revisa el descuento promedio y el tiempo de armado.

El proceso automático de la API cierra cada minuto los pedidos vencidos y los consolida, así que el pedido de papa (que cierra unas 5 horas después de crear la base) seguirá el mismo camino sin intervención.

## Trazabilidad con el diagrama de casos de uso

| Caso de uso | Pantalla (mobile) | Endpoint (api) |
|---|---|---|
| Iniciar sesión | `LoginScreen` | Firebase Auth · `POST /api/auth/demo-login` |
| Consultar catálogo del mayorista | `CreateOrderScreen` | `GET /api/productos` |
| Ver demanda sugerida por zona («extend») | `HomeScreen`, `CreateOrderScreen` | `GET /api/demanda/sugerida` → ML `/demanda/predecir` |
| Crear pedido grupal | `CreateOrderScreen` | `POST /api/pedidos-grupales` |
| Unirse a pedido grupal | `OrderDetailScreen` | `POST /api/pedidos-grupales/:id/unirse` |
| Pagar su parte («include») | `PaymentScreen` | `POST /api/participaciones/:id/pagar` → Culqi |
| Seguir estado del pedido | `OrdersScreen`, `OrderDetailScreen` | `GET /api/pedidos-grupales/mios` |
| Recibir notificaciones | `NotificationsScreen` + push | `GET /api/notificaciones` · FCM |
| Publicar productos y precios | `CatalogScreen`, `ProductEditScreen` | `POST/PATCH /api/mayorista/productos` |
| Definir descuentos por volumen | `ProductEditScreen` | `PUT /api/mayorista/productos/:id/descuentos` |
| Consolidar demanda por zona (sistema) | Job automático | `services/flows.ts` → ML `/pedidos/agrupar` |
| Revisar pedido consolidado («include») | `ConsolidatedScreen`, `ConsolidatedDetailScreen` | `GET /api/mayorista/consolidados/:id` |
| Aceptar o rechazar oferta | `ConsolidatedDetailScreen` | `POST /api/mayorista/ofertas/:id/aceptar\|rechazar` |
| Gestionar entregas | `ConsolidatedDetailScreen` | `POST .../entrega` · `PATCH /api/mayorista/entregas/:id` |
| Gestionar comercios y zonas | `MerchantsScreen`, `ZonesScreen` | `/api/admin/comercios`, `/api/admin/zonas` |
| Ver indicadores | `IndicatorsScreen` | `GET /api/admin/indicadores` |

Ciclo de vida del pedido (`api/src/domain/orderState.ts`): `ABIERTO → CERRADO → CONSOLIDADO → OFERTA_ACEPTADA → PAGADO → EN_REPARTO → ENTREGADO`, con `CANCELADO` si vence sin participantes o el mayorista rechaza.

## Pruebas

```bash
cd api && npm install && npm test             # precios por volumen y estados
cd ml-service && pip install -r requirements.txt && pytest   # modelo y clustering
```

## Pasar de la demo a producción

**Base de datos real.** Todo el acceso pasa por `api/src/db.ts` y SQL explícito en `routes/` y `services/`. Para la base definitiva basta con reemplazar `database/`, ajustar las consultas si cambian nombres de tablas o columnas y apuntar `DATABASE_URL` al nuevo servidor. El servicio de ML solo necesita la tabla (o vista) `historial_demanda` y escribe en `prediccion_demanda`.

**Firebase.** Crea un proyecto en Firebase Console y activa Authentication con correo y contraseña. En la app, completa las variables `EXPO_PUBLIC_FIREBASE_*` y agrega `google-services.json` / `GoogleService-Info.plist` en `mobile/` (y la clave `googleServicesFile` en `app.json`). En la API, descarga la cuenta de servicio y define `FIREBASE_SERVICE_ACCOUNT`. Las notificaciones push requieren un *development build* (`npx expo run:android`); Expo Go no recibe push de FCM.

**Culqi.** Define `EXPO_PUBLIC_CULQI_PUBLIC_KEY` en la app y, en la API, `PAYMENT_GATEWAY=culqi` con `CULQI_SECRET_KEY`. La tarjeta se tokeniza en el celular; la API solo recibe el token.

**Seguridad.** Cambia `DEMO_MODE=false` (la API se niega a arrancar en `NODE_ENV=production` con el modo demo activo) y cambia `ML_INTERNAL_KEY`.

## Marco legal considerado

La **Ley N.º 29733** se cubre con `consentimiento_datos` (aceptación obligatoria en el registro, versión de política y revocación desde *Mi negocio*), y los montos de cada comercio no se muestran a los demás participantes. La **Ley MYPE N.º 28015 / 30056** se refleja en el atributo `es_mype` del comerciante, visible para el administrador.

## Limitaciones conocidas

El código se escribió sin acceso a internet: la lógica de dominio y el ML tienen pruebas que pasan, pero la API aún no se ha ejecutado contra PostgreSQL ni la app en un emulador, así que en la primera ejecución pueden aparecer ajustes menores. El registro de nuevos usuarios existe en la API (`POST /api/auth/registro`) pero todavía no tiene pantalla en la app. El job automático corre dentro de la API; con varias réplicas conviene moverlo a un cron externo.
