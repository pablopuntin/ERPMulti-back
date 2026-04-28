# Backend ELECTROTEC

API NestJS del ERP/POS multi-sucursal de ELECTROTEC.

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

Scripts principales:

- **`start:dev`**: desarrollo con watch
- **`build`**: compila a `dist/`
- **`start:prod`**: ejecuta el build compilado
- **`lint`**: ejecuta ESLint con autofix
- **`test`**: pruebas unitarias
- **`test:e2e`**: pruebas end-to-end

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
POST /api/stock/transfer
GET  /api/reports/daily
GET  /api/customers/:id/credit-summary
```

---

## Arquitectura modular real

Módulos importados actualmente en `AppModule`:

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
- **`payments/`**
- **`cash/`**
- **`expenses/`**
- **`purchase/`**
- **`reports/`**

Además, `customers/`, `orders/` y `payments/` ya integran el módulo interno de **cuenta corriente de clientes**.

---

## Controladores y rutas base reales

- **`/auth`**
- **`/users`**
- **`/branches`**
- **`/customers`**
- **`/categories`**
- **`/brands`**
- **`/suppliers`**
- **`/products-base`**
- **`/product-variants`**
- **`/product-images`**
- **`/stock`**
- **`/price-history`**
- **`/price-rules`**
- **`/orders`**
- **`/payments`**
- **`/cash`**
- **`/expenses`**
- **`/purchases`**
- **`/reports`**

Además existe un controlador raíz en `/`.

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
- si no llega, los módulos operativos suelen resolver sucursal desde **`activeBranchId`** o `branchId` del JWT
- usuarios globales pueden cambiar sucursal vía **`POST /auth/switch-branch`**
- la utilidad **`branch-scope.util.ts`** concentra buena parte del hardening multi-sucursal, aunque todavía hay módulos antiguos con lógica ad hoc

---

## Flujos operativos reales

### Órdenes, cobro y entrega

- la orden guarda su sucursal operativa
- el flujo desacopla **venta** de **cobro/caja**
- el pago no lo crea la orden por sí sola
- caja opera sobre una cola de remitos y entregas
- existen remitos acumulados y remitos por evento de entrega

### Caja

- cada caja está asociada a una sucursal
- la operación diaria gira alrededor de `cash_register` y sus movimientos
- `GET /cash/current` requiere una sucursal resuelta o activa

### Gastos y compras

- gastos fijos y variables impactan caja
- si no existe caja abierta, ciertos flujos pueden abrirla automáticamente
- compras impactan caja como egreso y operan con sucursal resuelta

### Stock y transferencias

- el módulo `stock` administra movimientos, alertas y transferencias
- la visibilidad comercial del catálogo se desacopla del stock mediante asignaciones explícitas de variantes por sucursal
- hoy el sistema maneja ubicaciones reales:
  - `branch`
  - `warehouse`
  - `transit`
  - `preorder`
- las transferencias quedan registradas de forma auditable en `stock_transfers`

### Reportes

- reportes financieros y movimientos salen de `cash_movements`
- el filtro por sucursal depende del `cash_register.branchId`
- existen endpoints de resumen diario, finanzas, utilidad, movimientos de caja y stock

### Catálogo de productos por sucursal

- `product_variant_branches` define en qué sucursal una variante puede verse/venderse
- `stock_locations` sigue siendo la fuente de verdad del stock físico por ubicación
- altas manuales e importaciones masivas asignan variantes automáticamente a la sucursal activa resuelta desde JWT
- `gerente_sucursal` puede importar/exportar CSV de productos, siempre dentro de su sucursal activa
- el CSV de exportación replica el formato esperado por el import masivo y normaliza precios a 2 decimales
- usuarios globales también operan por sucursal activa en flujos diarios; la vista multi-sucursal queda reservada a reportes comparativos

### Cuenta corriente de clientes

- ya existe un MVP funcional de cuenta corriente como tipo de financiación de la venta
- la deuda por remito se sincroniza desde órdenes y pagos
- hay trazabilidad por:
  - **documentos** (`customer_credit_documents`)
  - **movimientos** (`customer_credit_movements`)
- existen endpoints de lectura para:
  - resumen del cliente
  - comprobantes
  - movimientos
- el circuito de gestión operativa todavía está incompleto: faltan mejores flujos de cobro posterior y semántica contable más fina para ajustes/repricing

---

## Endpoints destacados

### Auth

```http
POST /auth/login
POST /auth/register
POST /auth/switch-branch
```

### Clientes y cuenta corriente

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

Los endpoints de catálogo y de importación/alta usan la sucursal activa del usuario para encapsular la operación cotidiana por sucursal.
GET  /product-variants/:id/stock-by-branch

POST /stock/transfer
GET  /stock/transfers
GET  /stock/transfers/:id
GET  /stock/alerts/active
```

### Operación

```http
GET    /orders
POST   /orders
GET    /orders/:id
GET    /orders/:id/remito-pdf
GET    /orders/:id/delivery-events/:deliveryEventId/remito-pdf
GET    /orders/cash/pending-deliveries

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

## Observaciones de auditoría

- el endpoint **`/product-variants/:id/stock-by-branch`** hoy devuelve más que sucursales; el nombre quedó corto frente al comportamiento actual
- la API real sí usa prefijo global **`/api`**
- sigue existiendo lógica de resolución de sucursal distribuida entre varios módulos
- la cuenta corriente ya no está “sin integrar”: hoy existe un read model y sincronización básica, pero no una gestión operativa completamente cerrada

---

## Pendientes técnicos conocidos

- consolidar la resolución de sucursal en una estrategia compartida para todos los módulos
- renombrar endpoints cuyo nombre ya no refleja exactamente el contrato actual
- reforzar pruebas de consistencia entre `stock`, `orders`, `payments`, `cash` y `reports`
- mejorar el circuito de cobros posteriores de cuenta corriente y la diferenciación entre `payment`, `reprice`, `discount`, `surcharge` y `manual_adjustment`
- reducir logs de depuración una vez cerrado el diagnóstico operativo
