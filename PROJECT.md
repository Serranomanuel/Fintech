# Finanzas Personales - Documentación del Proyecto

> **IMPORTANTE para IA**: Este documento es la fuente de verdad sobre el estado del proyecto. Actualízalo después de cada cambio significativo (nuevas features, refactorizaciones, fixes, cambios en esquema de BD, etc). Si modificas archivos, verifica que esta documentación refleje el estado actual.

---

## 1. Descripción general

PWA (Progressive Web App) para control personal de finanzas. Permite registrar ingresos/gastos, ver resúmenes por período, gestionar deudas con planes de pago y seguimiento de progreso, y crear planes de ahorro con metas y depósitos. Usa Supabase como backend (auth + base de datos) y Vite como bundler.

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML vanilla, CSS vanilla, JavaScript ES modules |
| Bundler | Vite 6.x |
| Backend/DB | Supabase (PostgreSQL + Auth + Row Level Security) |
| PWA | Service Worker manual (no workbox), Web App Manifest |
| Hosting | Cualquier estático (Netlify, Vercel, GitHub Pages, etc.) |
| Fuente | Google Fonts (Inter) |

---

## 3. Estructura del proyecto

```
Finanzas_personales_control_app/
├── index.html              # Entry point HTML
├── app.js                  # Punto de entrada: bootstrap, event listeners, form handlers
├── config.js               # Credenciales Supabase (lee de .env via import.meta.env)
├── supabaseService.js      # Capa de acceso a datos (CRUD transacciones + deudas + ahorros)
├── styles.css              # Todos los estilos CSS
├── vite.config.js          # Configuración de Vite (base: "./")
├── package.json            # Dependencias y scripts
├── supabase-schema.sql     # Esquema completo de BD (ejecutar en Supabase SQL Editor)
├── .env                    # Variables de entorno (NO commitear)
├── .env.example            # Plantilla de variables de entorno
├── .gitignore              # Excluye node_modules/, dist/, .env
├── js/                     # Módulos de la aplicación
│   ├── state.js            # Estado global + setState() + listeners
│   ├── utils.js            # Utilidades: formatCurrency, parseAmount, esc, dates, etc.
│   ├── modals.js           # Gestión de modales (open/close + functions por cada modal)
│   └── views/              # Rendering de cada vista
│       ├── dashboard.js    # renderDashboard, renderInsights
│       ├── transactions.js # renderPeriodTransactions
│       ├── debts.js        # renderDebts, renderDebtDetail
│       └── savings.js      # renderSavings, renderSavingsDetail
├── tests/                  # Tests unitarios
│   └── utils.test.js       # Tests para funciones utilitarias
├── public/                 # Archivos estáticos copiados tal cual a dist/
│   ├── manifest.json       # Web App Manifest
│   ├── service-worker.js   # Service Worker (precaching + network-first)
│   └── icons/
│       ├── icon-192.svg
│       └── icon-512.svg
├── dist/                   # Build de producción (NO commitear)
└── node_modules/
```

---

## 4. Base de datos (Supabase)

### 4.1 Tablas

#### `profiles`
Extiende auth.users con datos de perfil.
| Columna | Tipo | Descripción |
|---------|------|------------|
| id | uuid (PK, FK → auth.users) | Relacionado con auth |
| preferred_currency | text (default 'COP') | COP, USD, EUR o MXN |
| created_at | timestamptz | Auto |

#### `transactions`
Movimientos financieros (ingresos y gastos).
| Columna | Tipo | Descripción |
|---------|------|------------|
| id | uuid (PK) | Auto-generated |
| user_id | uuid (FK → auth.users) | Dueño del registro |
| type | text | 'income' o 'expense' |
| amount | numeric(14,2) | Siempre positivo (> 0) |
| category | text | Alimentación, Transporte, Trabajo, Vivienda, Servicios, Ocio |
| description | text | Nota del usuario (max 48 chars en UI) |
| date | timestamptz | Fecha del movimiento |
| created_at | timestamptz | Auto |

#### `debts`
Deudas registradas por el usuario.
| Columna | Tipo | Descripción |
|---------|------|------------|
| id | uuid (PK) | Auto-generated |
| user_id | uuid (FK → auth.users) | Dueño |
| name | text | Nombre descriptivo |
| creditor | text | Entidad bancaria o acreedor |
| total_amount | numeric(14,2) | Monto original de la deuda |
| remaining_amount | numeric(14,2) | Saldo pendiente |
| interest_rate | numeric(5,2) | Tasa de interés anual (%) |
| minimum_payment | numeric(14,2) | Cuota mínima mensual |
| due_day | integer (1-31) | Día del mes en que vence |
| start_date | date | Fecha de inicio |
| status | text | 'active', 'paid' o 'paused' |
| created_at | timestamptz | Auto |

#### `debt_payments`
Pagos individuales contra cada deuda.
| Columna | Tipo | Descripción |
|---------|------|------------|
| id | uuid (PK) | Auto-generated |
| debt_id | uuid (FK → debts) | Deuda que se paga |
| user_id | uuid (FK → auth.users) | Quién paga |
| amount | numeric(14,2) | Monto del pago |
| note | text | Nota opcional |
| payment_date | timestamptz | Cuándo se registró |
| created_at | timestamptz | Auto |

#### `savings_plans`
Planes de ahorro del usuario.
| Columna | Tipo | Descripción |
|---------|------|------------|
| id | uuid (PK) | Auto-generated |
| user_id | uuid (FK → auth.users) | Dueño |
| name | text | Nombre del plan |
| target_amount | numeric(14,2) | Meta de ahorro |
| current_amount | numeric(14,2) | Acumulado actual (default 0) |
| color | text | Identificador visual: violet, blue, teal, rose, amber |
| deadline | date | Fecha límite (opcional) |
| status | text | 'active' o 'completed' |
| created_at | timestamptz | Auto |

#### `savings_deposits`
Depósitos individuales en cada plan.
| Columna | Tipo | Descripción |
|---------|------|------------|
| id | uuid (PK) | Auto-generated |
| plan_id | uuid (FK → savings_plans) | Plan al que se deposita |
| user_id | uuid (FK → auth.users) | Quién deposita |
| amount | numeric(14,2) | Monto del depósito |
| note | text | Nota opcional |
| deposit_date | timestamptz | Cuándo se registró |
| created_at | timestamptz | Auto |

#### `budgets`
Límites de gasto mensual por categoría.
| Columna | Tipo | Descripción |
|---------|------|------------|
| id | uuid (PK) | Auto-generated |
| user_id | uuid (FK → auth.users) | Dueño |
| category | text | Nombre de la categoría |
| monthly_limit | numeric(14,2) | Límite mensual (> 0) |
| created_at | timestamptz | Auto |

**Unique constraint**: (user_id, category) — upsert para actualizar

### 4.2 Row Level Security (RLS)

Cada tabla tiene policies que aseguran que un usuario solo pueda ver/modificar sus propios datos usando `auth.uid()`. Las policies están definidas en `supabase-schema.sql`.

### 4.3 Trigger

`handle_new_user()`: Se ejecuta al insertar un usuario nuevo en `auth.users` y crea automáticamente un registro en `profiles` con la moneda por defecto (COP).

---

## 5. Arquitectura de la aplicación

### 5.1 Flujo de autenticación

1. `bootstrap()` llama a `getSession()` para verificar si hay sesión activa
2. Si hay sesión → `loadSession()` carga perfil + transacciones + deudas + planes de ahorro
3. Si no hay sesión → muestra vista de auth (login/registro)
4. `onAuthStateChange()` escucha cambios de sesión en tiempo real

### 5.2 Estado global (`js/state.js`)

El estado se maneja con `getState()` / `setState()` / `onStateChange()`:

```javascript
// state.js
let state = {
  activeUser: null,        // Objeto usuario de Supabase Auth
  transactions: [],        // Array de transacciones del usuario
  debts: [],               // Array de deudas del usuario
  savingsPlans: [],        // Array de planes de ahorro del usuario
  budgets: [],             // Array de presupuestos por categoría
  currentCurrency: "COP",  // Moneda activa para formato visual
  authMode: "signin",      // 'signin' o 'signup'
  activePeriod: "month",   // 'week', 'month', 'year', 'all'
  currentView: "home",     // 'home', 'transactions', 'debts', 'savings', 'settings'
  showAllTransactions: false,
  selectedDebtId: null,
  selectedSavingsId: null,
  isLoading: false,
  darkMode: true,          // Modo oscuro activo
};
```

Cada vista se suscribe con `onStateChange()` y solo re-renderiza cuando sus datos cambian.

### 5.3 Módulos

| Módulo | Responsabilidad |
|--------|----------------|
| `app.js` | Bootstrap, event listeners, form handlers, orquestación |
| `js/state.js` | Estado global reactivo (getState/setState/onStateChange) |
| `js/utils.js` | Funciones puras: formatCurrency, parseAmount, esc, fechas, etc. |
| `js/modals.js` | Abrir/cerrar modales, pre-llenar formularios en modo edición |
| `js/views/dashboard.js` | Dashboard: balance, score salud, presupuestos, calendario, insights, recientes |
| `js/views/transactions.js` | Lista de transacciones agrupadas por fecha |
| `js/views/debts.js` | Tarjetas de deudas + detalle con historial de pagos |
| `js/views/savings.js` | Tarjetas de ahorros + detalle con historial de depósitos |
| `js/views/calendar.js` | Calendario mensual con eventos de deudas y metas |

### 5.4 Navegación

La app tiene 5 vistas principales controladas por `setView(view)`:
- **home** - Dashboard con resumen, insights, movimientos recientes
- **transactions** - Vista completa con filtros por período
- **debts** - Gestión de deudas con tarjetas de progreso
- **savings** - Planes de ahorro con metas, progreso y depósitos
- **settings** - Cambio de moneda y cerrar sesión

Los modales se abren con `openModal(id, trigger)` y cierran con `closeModal(id)`. Soporte para Escape y click fuera del modal.

### 5.4 Service Worker

Estrategia: **Cache-first con actualización en background**
1. Precachea: `index.html`, `manifest.json`, iconos
2. Para requests de red: retorna caché si existe, simultáneamente fetch actualiza la caché
3. Excluye requests a `/rest/v1/` y `/auth/v1/` (API de Supabase)
4. Versionado por `CACHE_NAME` (actualmente `finanzas-v6`)

---

## 6. Funcionalidades actuales

### Auth
- Login / Registro con email y contraseña
- Manejo de errores (credenciales inválidas, usuario existente, confirmación pendiente)
- Cierre de sesión

### Dashboard (Inicio)
- Balance total (ingresos - gastos acumulados)
- Resumen del mes: ingresos y gastos
- Resumen de deudas: cuota mínima mensual + disponible tras deudas
- **Score de salud financiera** (0-100): gauge circular con detalles de ahorro, deuda y estado
- **Presupuestos por categoría**: barras de progreso con límite mensual, alerta al exceder
- **Calendario de pagos**: grilla del mes con días de vencimiento de deudas y metas de ahorro
- Top 3 categorías de gasto con barras de progreso
- Últimos 3 movimientos (con opción de ver todos)

### Movimientos (filtrado por período)
- 4 filtros: Semana, Mes, Año, Todo
- Tarjeta resumen: ingresos, gastos, neto del período
- Lista agrupada por fecha con "Hoy", "Ayer" o fecha completa
- Botón de eliminar en cada movimiento

### Deudas
- **Crear deuda**: nombre, acreedor, monto total, cuota mínima, interés, día de pago
- **Ver deudas**: tarjetas con nombre, acreedor, restante, cuota mín, día pago, barra de progreso %
- **Registrar pago**: monto + nota, valida contra saldo restante, actualiza estado a "paid" si se paga completo
- **Detalle de deuda**: info completa + historial de pagos con opción de eliminar pagos
- **Eliminar deuda**: con confirmación
- **Resumen**: deuda total, ya pagado, progreso general (%)

### Ahorros
- **Crear plan**: nombre, meta, color visual, fecha límite opcional
- **Ver planes**: tarjetas con nombre, color dot, objetivo, acumulado, fecha límite, estado
- **Registrar depósito**: monto + nota, actualiza acumulado, marca como "completed" al alcanzar meta
- **Detalle de ahorro**: info completa + historial de depósitos con opción de eliminar
- **Eliminar plan**: con confirmación
- **Resumen**: total ahorrado, planes activos, planes completados

### Formato de moneda
- COP (es-CO, sin decimales), USD (en-US), EUR (de-DE), MXN (es-MX)
- Solo cambia formato visual, no convierte valores

### Modo oscuro / Claro
- Toggle en Ajustes con persistencia en localStorage
- Respeta preferencia del sistema (prefers-color-scheme)
- Paleta personalizada: #0B1320, #0B7285, #2EC4B6, #A7F3D0, #E6FFFA

### Presupuestos por categoría
- Establecer límite mensual por categoría (Alimentación, Transporte, etc.)
- Upsert: si ya existe un presupuesto para la categoría, se actualiza
- Barras de progreso en dashboard muestran gastado vs límite
- Alerta visual (barra roja) al exceder el presupuesto

### Score de salud financiera
- Compuesto: tasa de ahorro, ratio deuda/ingreso, adherencia a presupuesto, fondo de emergencia
- Visualización: gauge SVG circular (0-100) con color dinámico
- Desglose: % ahorro mensual, deuda total, total ahorrado, estado

### Calendario de pagos
- Grilla del mes actual con días marcados
- Eventos: cuotas de deudas (día de vencimiento) y metas de ahorro (fecha límite)
- Colores: rojo para deudas, teal para ahorros
- Indicador de urgencia: <=3 días (urgente), <=7 días (próximo)

### Exportar datos
- Botón en Ajustes para descargar transacciones como CSV
- Encoding UTF-8 con BOM para compatibilidad con Excel
- Columnas: Fecha, Tipo, Categoría, Descripción, Monto

---

## 7. Cómo ejecutar

### Desarrollo
```bash
npm run dev
```
Abre en `http://localhost:5173` (Vite abre automáticamente).

### Build de producción
```bash
npm run build
```
Genera `dist/` con archivos optimizados.

### Preview del build
```bash
npm run preview
```
Sirve `dist/` localmente.

---

## 8. Despliegue

1. Ejecutar `npm run build`
2. Subir la carpeta `dist/` a tu hosting estático
3. Configurar rewrite de SPA si es necesario (todo a `index.html`)
4. Asegurar que `config.js` tenga las credenciales correctas de Supabase

**Importante**: El service worker requiere HTTPS para funcionar.

---

## 9. Configuración de Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a SQL Editor y ejecutar todo el contenido de `supabase-schema.sql`
3. Copiar la URL del proyecto y la anon key
4. Pegarlas en `config.js`:
```javascript
export const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
export const SUPABASE_ANON_KEY = "eyJ...";
```

La anon key es pública por diseño. La seguridad la manejan las RLS policies.

---

## 10. Categorías disponibles

Las categorías están hardcodeadas en el HTML y JS:
- Alimentación (A), Transporte (T), Trabajo (W), Vivienda (V), Servicios (S), Ocio (O)

Para agregar una categoría, hay que modificar:
1. Los botones en `index.html` (dentro de `.category-options`)
2. No hay migración de datos necesaria porque se guarda como texto

---

## 11. Notas de implementación

- **Parseo de montos**: Acepta formato LATAM (punto como separador de miles, coma como decimal) y formato US. `parseAmount()` normaliza todo.
- **Fechas**: Se guardan como UTC en Supabase. Se renderizan en timezone local del usuario.
- **Supabase CDN**: Se importa desde `cdn.jsdelivr.net` como ESM. Vite lo bundea en producción.
- **Service worker path**: Se registra como `./service-worker.js` que Vite resuelve correctamente tanto en dev como en build.

---

## 12. Pendiente / TODO

- [ ] Agregar paginación o scroll infinito para muchos movimientos
- [ ] Gráficas de tendencias mensuales
- [ ] Recordatorios de pago de deudas (notificaciones push)
- [ ] Categorías personalizables por el usuario
- [ ] Modo offline completo con cola de sincronización
- [x] ~~Tests unitarios~~ (Vitest configurado, tests en tests/)
- [x] ~~Presupuestos por categoría~~
- [x] ~~Exportar datos a CSV~~
- [x] ~~Modo oscuro/claro~~
- [x] ~~Score de salud financiera~~
- [x] ~~Calendario de pagos~~

---

## 13. Historial de cambios

| Fecha | Cambio |
|-------|--------|
| 2025-07-17 | Fix: eliminados archivos duplicados (SW, manifest, icons en raíz) |
| 2025-07-17 | Fix: reescrito service-worker con network-first + precaching |
| 2025-07-17 | Fix: manifest.json con metadata válida |
| 2025-07-17 | Fix: agregado .gitignore |
| 2025-07-17 | Feature: vista Movimientos con filtros por semana/mes/año/todo |
| 2025-07-17 | Feature: módulo completo de Deudas (CRUD + pagos + progreso) |
| 2025-07-17 | Feature: balance mensual incluye cuotas de deudas y disponible |
| 2025-07-17 | DB: tablas debts y debt_payments con RLS |
| 2025-07-17 | Fix: SQL idempotente (DROP POLICY IF EXISTS) |
| 2025-07-17 | UI: Rediseño visual completo — minimalista, design system con variables, mejor tipografía, bordes sutiles, glassmorphism en nav/modals |
| 2025-07-17 | Feature: módulo completo de Ahorros (CRUD + depósitos + progreso + colores) |
| 2025-07-17 | DB: tablas savings_plans y savings_deposits con RLS |
| 2025-07-17 | UI: CSS completo reescrito incluyendo estilos de ahorros |
| 2025-07-21 | Refactor: app.js modularizado en js/state.js, js/utils.js, js/modals.js, js/views/* |
| 2025-07-21 | Feature: re-render selectivo — solo la vista activa se actualiza al cambiar estado |
| 2025-07-21 | Feature: loading spinner durante carga de datos iniciales |
| 2025-07-21 | Feature: edición de transacciones, deudas y planes de ahorro |
| 2025-07-21 | Fix: campo "months" del formulario de ahorros ahora se guarda en la BD |
| 2025-07-21 | Security: credenciales Supabase movidas a .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) |
| 2025-07-21 | UX: confirmación antes de eliminar pagos y depósitos individuales |
| 2025-07-21 | CSS: prefers-reduced-motion para barras de progreso y transiciones |
| 2025-07-21 | Repo: dist/ eliminado del tracking git, .gitignore actualizado con .env |
| 2025-07-21 | Feature: presupuestos por categoría (DB budgets, modal, dashboard bars) |
| 2025-07-21 | Feature: exportar transacciones a CSV |
| 2025-07-21 | Feature: modo oscuro/claro con paleta personalizada (#0B1320, #0B7285, #2EC4B6, #A7F3D0, #E6FFFA) |
| 2025-07-21 | Feature: score de salud financiera (gauge SVG 0-100, desglose de métricas) |
| 2025-07-21 | Feature: calendario de pagos (grilla mensual, eventos de deudas y ahorros) |
| 2025-07-21 | Fix: modals.js importa de utils.js (eliminada duplicación de funciones) |
| 2025-07-21 | Fix: vistas importan directamente de supabaseService.js (eliminado window.__deps) |
| 2025-07-21 | Fix: config.js lee solo de .env (eliminadas credenciales hardcodeadas) |
