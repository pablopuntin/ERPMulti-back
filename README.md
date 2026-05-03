# Backend ELECTROTEC

API NestJS del ERP/POS multi-sucursal de ELECTROTEC.

Este backend ya soporta operación diaria real con foco en:

- encapsulamiento estricto por sucursal
- trazabilidad de actor, documento y movimiento
- separación progresiva entre intención comercial, realidad transaccional, realidad documental y realidad monetaria

Hoy la dirección arquitectónica es esta:

- `orders`: intención comercial y pre-venta
- `sales`: realidad comercial confirmada
- `remitos`: realidad documental y logística
- `payments`: eventos monetarios
- `cash`: impacto real en caja
- `customer-credit`: read model / transición hacia un ledger formal de cuenta corriente

---

## Stack

- **NestJS 11**
- **TypeORM 0.3**
- **PostgreSQL**
- **JWT + Passport**
- **Swagger**
- **Jest**
- **XLSX** para importaciones de catálogo
- **PDFKit** para generación de remitos PDF

---

## Scripts

```bash
npm install
npm run start:dev
npm run build
npm run start:prod
npm run lint
npm run test
npm run test:e2e
```

- **`start:dev`**
  - levanta el backend en modo desarrollo con watch

- **`build`**
  - compila a `dist/`

- **`start:prod`**
  - ejecuta el build compilado

- **`lint`**
  - ejecuta ESLint con autofix

- **`test`**
  - pruebas unitarias existentes

- **`test:e2e`**
  - pruebas end-to-end existentes

---

## Variables de entorno mínimas

```env
PORT=4000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=electrotec

JWT_SECRET=change-me
JWT_EXPIRES_IN=7d

ROOT_EMAIL=root@electrotec.com
ROOT_PASSWORD=RootSecurePassword123!
```

---

## Setup local

```bash
npm install
npm run start:dev
```

URLs por defecto:

- **API**: `http://localhost:4000/api`
- **Swagger**: `http://localhost:4000/api/swagger`

## Nota sobre rutas

La API usa prefijo global **`/api`**.

Ejemplos reales:

```http
POST /api/auth/login
GET  /api/orders
GET  /api/remitos
POST /api/stock/transfer
GET  /api/reports/daily
GET  /api/customers/:id/credit-summary
```

---

## Arquitectura modular real

Módulos detectados actualmente en la aplicación:

- **`auth/`**
- **`users/`**
- **`branches/`**
- **`customers/`**
- **`categories/`**
- **`brands/`**
- **`suppliers/`**
- **`products-base/`**
- **`products-variants/`**
- **`product-image/`**
- **`stock/`**
- **`price-history/`**
- **`price-rules/`**
- **`orders/`**
- **`sales/`**
- **`remitos/`**
- **`payments/`**
- **`cash/`**
- **`expenses/`**
- **`purchase/`**
- **`reports/`**

Además:

- `customers/`, `orders/` y `payments/` ya integran la capa actual de **cuenta corriente de clientes**
- `remitos/` ya concentra la **lectura documental** y la **generación PDF** de remitos
- `orders/` conserva el flujo operativo de revisión, entrega y finalización, pero ya no debe seguir absorbiendo responsabilidades documentales nuevas

---

## Principios de arquitectura vigentes

### 1. Multi-sucursal primero

Toda operación operativa, financiera o documental debe quedar encapsulada por sucursal.

### 2. `orders` no es la verdad final del negocio

`Order` representa una intención comercial y el flujo previo a la concreción en caja.

No debe consolidarse como fuente de verdad de:

- deuda viva
- documentos finales
- pagos aplicados históricamente
- reportes comerciales finales

### 3. `sales` es la realidad comercial confirmada

Cuando caja confirma una operación, se genera una `Sale` con snapshot comercial consistente.

### 4. `remitos` es la realidad documental y logística

Los remitos, sus PDFs y sus lecturas deben vivir en `remitos/`, no en `orders/`.

### 5. `payments` y `cash` no son lo mismo

- `Payment` representa un evento monetario
- `CashMovement` representa el impacto efectivo en caja

### 6. La cuenta corriente debe terminar en ledger

La capa actual de cuenta corriente funciona como transición operativa útil, pero el objetivo es evolucionar a un ledger con movimientos explícitos, reversión y trazabilidad estricta.

---

## Modelo de autenticación y scope multi-sucursal

El JWT expone contexto suficiente para encapsular operaciones por sucursal:

```json
{
  "sub": "user-id",
  "email": "user@email.com",
  "name": "Usuario",
  "role": "manager",
  "branchId": "branch-id",
  "activeBranchId": "branch-id",
  "allowedBranchIds": ["branch-id"],
  "hasAllBranchAccess": false,
  "canCreateUsers": ["cashier", "seller"],
  "permissions": ["operate_branch", "manage_products", "view_branch_reports"]
}
```

### Reglas actuales

- si llega **`branchId`** explícito, el backend valida acceso a esa sucursal
- si no llega, los módulos operativos deben resolver sucursal desde **`activeBranchId`** o `branchId` del JWT
- usuarios globales pueden cambiar sucursal vía **`POST /auth/switch-branch`**
- la utilidad **`src/common/auth/branch-scope.util.ts`** es la base compartida para endurecer lecturas y escrituras multi-sucursal

### Invariante importante

Los usuarios globales también operan por **sucursal activa** en flujos diarios.

La vista multi-sucursal debe quedar reservada principalmente a:

- reportes comparativos
- auditoría
- operaciones expresamente autorizadas

---

## Flujos operativos actuales

### Orders, caja, sale y remito

Flujo simplificado actual:

1. se crea `Order`
2. se envía a caja
3. caja revisa cantidades aprobadas y entregables
4. se registra pago si corresponde
5. se sincroniza deuda / cuenta corriente actual
6. se crea `Sale`
7. se crea o actualiza `Remito`
8. se emite PDF desde `remitos/`

### Remitos

Hoy existen:

- **remito acumulado**
- **remito por evento de entrega**

Y `remitos/` ya expone lectura dedicada:

- `GET /remitos`
- `GET /remitos/:id`
- `GET /remitos/:id/pdf`

con filtros por:

- `branchId`
- `saleId`
- `orderId`
- `customerId`

### Caja

- cada caja está asociada a una sucursal
- `cash_register` y `cash_movements` son la base de la caja operativa
- `GET /cash/current` requiere una sucursal resuelta o activa

### Cuenta corriente

Estado actual:

- ya existe un MVP funcional
- la deuda se sincroniza desde órdenes/pagos
- ya hay lectura por resumen, comprobantes y movimientos
- todavía falta blindar el modelo final como ledger de cuenta corriente

### Catálogo y stock por sucursal

- `product_variant_branches` define **visibilidad/asignación comercial** por sucursal
- `stock_locations` sigue siendo la fuente de verdad del stock físico por ubicación
- una variante puede ser visible en una sucursal aunque tenga stock cero
- altas manuales e importaciones asignan variantes automáticamente a la sucursal activa resuelta

### Compras y stock

Actualmente existe módulo `purchase/`, pero el modelo todavía debe endurecerse para separar con claridad:

- orden de compra
- recepción parcial/total
- aumento real de stock al recepcionar
- impacto económico y documental

---

## Endpoints destacados

### Auth

```http
POST /auth/login
POST /auth/register
POST /auth/switch-branch
```

### Clientes y cuenta corriente actual

```http
GET    /customers
POST   /customers
PATCH  /customers/:id
GET    /customers/:id/credit-summary
GET    /customers/:id/credit-documents
GET    /customers/:id/credit-movements
```

### Catálogo y stock

```http
GET  /products-base
POST /products-base
POST /products-base/import/preview-file
POST /products-base/import/file

GET  /product-variants
GET  /product-variants/catalog
POST /product-variants
PATCH /product-variants/:id
POST /product-variants/bulk-update-prices
GET  /product-variants/:id/stock-by-branch

POST /stock/transfer
GET  /stock/transfers
GET  /stock/transfers/:id
GET  /stock/alerts/active
```

### Operación comercial y documental

```http
GET    /orders
POST   /orders
GET    /orders/:id
GET    /orders/cash/pending-deliveries

GET    /remitos
GET    /remitos/:id
GET    /remitos/:id/pdf

GET    /payments
POST   /payments

GET    /cash/current
POST   /cash/open
POST   /cash/movement

GET    /expenses/fixed
POST   /expenses/fixed
GET    /expenses/variable
POST   /expenses/variable

GET    /reports/finance
GET    /reports/cash-movements
GET    /reports/profit
GET    /reports/daily
GET    /reports/stock
```

---

## Archivos y zonas clave del backend

### Scope multi-sucursal

- **`src/common/auth/branch-scope.util.ts`**
  - resolver sucursal activa
  - validar acceso a sucursal solicitada
  - servir de base para lecturas y escrituras blindadas

### Orders

- **`src/orders/orders.service.ts`**
  - flujo operativo de caja
  - revisión
  - entrega
  - finalización
  - puente actual hacia `sales` y `remitos`

- **`src/orders/orders.controller.ts`**
  - endpoints operativos

### Sales

- **`src/sales/entities/sale.entity.ts`**
  - realidad comercial confirmada

### Remitos

- **`src/remitos/remitos.service.ts`**
  - creación y actualización de remitos
  - lectura filtrada
  - acceso al PDF

- **`src/remitos/remito-pdf.service.ts`**
  - layout PDF del remito
  - snapshots comerciales/documentales

- **`src/remitos/remitos.controller.ts`**
  - API documental dedicada

### Cuenta corriente actual

- `customers/`
- `payments/`
- servicios internos de customer credit

Esta parte existe, pero sigue siendo zona de evolución prioritaria.

---

## Reglas de negocio relevantes hoy

- el cobro puede registrarse aunque no exista stock total para entregar en el momento
- si hay faltante de stock, una venta común solo puede finalizarse con pago total
- la excepción es la venta en cuenta corriente
- en remitos totalmente impagos deben ocultarse importes
- si hubo pago parcial / saldo a cuenta corriente, el remito debe seguir mostrando trazabilidad del cobro y saldo
- cuenta corriente, cobros y movimientos deben preservar encapsulamiento estricto por sucursal
- la operación diaria usa sucursal activa; la visión multi-sucursal es una excepción analítica

---

## Estado actual

### Implementado

- autenticación JWT con contexto de sucursal
- autorización por rol y permisos
- `sales` introducido como realidad comercial derivada de `orders`
- `remitos` introducido como módulo documental y logístico dedicado
- lectura y PDF de remitos ya migrados a `remitos/`
- caja integrada con pagos y reportes
- gastos impactando caja y reportes
- stock físico por ubicación
- asignación comercial de variantes por sucursal
- cuenta corriente con resumen, documentos y movimientos de lectura

### En transición

- endurecimiento final de `orders` para que conserve solo intención y trazabilidad pre-venta
- migración completa de lógica logística residual desde `orders` a `remitos`
- evolución de cuenta corriente hacia ledger explícito
- mejoras de compras con recepción y aumento de stock por evento
- reportes avanzados apoyados más en `sales`, `remitos`, `cash` y futuros ledgers

---

## Pendientes técnicos conocidos

- consolidar la resolución de sucursal en una estrategia compartida para todos los módulos
- terminar de retirar rutas y consumos legacy de remito bajo `orders`
- reforzar consistencia entre `orders`, `sales`, `remitos`, `payments`, `cash` y `customer-credit`
- formalizar el ledger de cuenta corriente con reversión, ajustes y estados de cuenta
- modelar compras con recepción parcial/total e impacto de stock por evento de recepción
- renombrar endpoints cuyo nombre ya no refleja exactamente el contrato actual
- reducir logs de depuración una vez cerrado el diagnóstico operativo

---

## Documentos relacionados

- **`../front/README.md`**
  - frontend operativo y reglas de UI

- **`../README_TOTAL.md`**
  - visión integral del proyecto

- **`../ARQUITECTURA_SALES_REMITOS_CC.md`**
  - arquitectura objetivo del núcleo comercial/documental/financiero

- **`../README_IMPLEMENTACION_FUTURA.md`**
  - hoja de ruta recomendada para crédito, reportes avanzados, stock manual y compras
