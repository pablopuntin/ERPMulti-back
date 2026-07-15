# ERP — Auditoría Técnica v3

**Fecha:** Julio 2026
**Estado:** Sistema funcional con módulos core completos. Módulos secundarios en progreso.
**Deploy:** Backend en Render (`back-wpmg.onrender.com`) | Frontend en Vercel (`front-flax-nu.vercel.app`)
**API Docs:** `https://back-wpmg.onrender.com/api/swagger`

---

## Stack Tecnológico

### Backend
- **Framework:** NestJS 11 con TypeScript
- **ORM:** TypeORM 0.3.27
- **Base de datos:** PostgreSQL (Render)
- **Autenticación:** JWT + Passport
- **Documentación:** Swagger UI en `/api/swagger`
- **Validación:** class-validator + class-transformer
- **PDF:** PDFKit (generación de remitos)
- **Excel:** XLSX (importación masiva de productos)

### Frontend
- **Framework:** Next.js 16 con App Router
- **UI:** Material UI + Radix UI + TailwindCSS
- **Estado:** React hooks + localStorage
- **HTTP:** Axios con interceptores

---

## Arquitectura General

```
/src
  /account          → Cuenta corriente (ledger, ajustes, estado de cuenta)
  /auth             → JWT, login, switch-branch, registro
  /branches         → Sucursales, stock por ubicación, configuración de ventas
  /brands           → Marcas con asociación a categorías
  /cash             → Caja diaria (apertura, cierre, movimientos)
  /categories       → Categorías con soft-delete en cascada
  /customers        → Clientes internos con asignación por sucursal
  /expenses         → Gastos fijos y variables integrados a caja
  /orders           → Remitos (ciclo completo: draft → caja → entrega → finalización)
  /payments         → Pagos de remitos con integración a caja y ledger
  /price-history    → Historial de cambios de precio
  /price-rules      → Reglas de precio por marca/categoría con idempotencia
  /product-image    → Imágenes de variantes
  /products-base    → ProductBase con variantes, importación masiva, exportación CSV
  /products-variants → Variantes, catálogo paginado, bulk update precios/stock
  /purchase         → Compras a proveedores (en progreso)
  /remitos          → Documentos de entrega con PDF descargable
  /reports          → Reportes financieros, stock, ventas (en progreso)
  /sales            → Ventas generadas al finalizar remitos
  /stock            → Movimientos, transferencias, alertas, reservas
  /stock-adjustment → Ajuste de inventario con trazabilidad
  /suppliers        → Proveedores y productos de proveedor (CRUD básico)
  /users            → Usuarios con roles y asignación multi-sucursal
  /common/auth      → branch-scope.util: resolución de scope por sucursal
```

---

## Módulos Completos y Operativos

### Auth
- Login con bcrypt + JWT
- `switch-branch`: cambia sucursal activa sin nuevo login, reemite token
- Normalización de roles (compatibilidad con nombres legacy)
- `buildAuthScope`: permisos, sucursales permitidas y acceso global por rol
- Registro protegido por rol `root`

### Users
- CRUD con paginación
- Creación con asignación de sucursales y permisos granulares por sucursal
- Soft delete con reglas jerárquicas (root no se puede eliminar, gerente_general puede eliminar vendedores/cajeros, etc.)
- Reset de contraseña por root
- Sanitización de password en todas las respuestas

### Branches
- CRUD con soft delete lógico
- Stock por sucursal con filtro de stock bajo
- Configuración `restrictSalesToBranchStock`: modo estricto que bloquea ventas sin stock

### Categories / Brands
- Soft delete en cascada: desactivar categoría desactiva marcas sin otras categorías, y sus productos/variantes
- Asociación muchos-a-muchos categoría ↔ marca
- Restauración de categorías desactivadas

### Products Base + Variants
- Estructura jerárquica: `Category → Brand → ProductBase → ProductVariant`
- Importación masiva desde Excel o JSON con preview transaccional
  - Detección y reporte de errores por fila antes de confirmar
  - Creación automática de categorías, marcas y productBase faltantes
  - Upsert de variantes por SKU
  - Asignación automática a sucursal activa
- Exportación de template CSV con datos actuales
- Generación automática de SKU
- Catálogo paginado con filtros por categoría, marca, productBase, variante y búsqueda libre
- Stock por sucursal enriquecido en cada variante del catálogo
- Bulk update de precios: modos directo, porcentaje e incremento, con base en precio de venta o costo
- Bulk update de stock por ubicación
- Historial de cambios de precio integrado
- Soft delete en cascada (ProductBase desactiva todas sus variantes)

### Stock
- `StockLocation`: stock físico por variante + sucursal + tipo de ubicación (branch / warehouse / transit / preorder)
- Ciclo completo de reserva: `reserve → release / consume`
- Transferencias entre ubicaciones con historial (`StockTransfer`)
- Alertas de stock bajo por ubicación y total, con resolución manual
- `ensureVariantAssignment`: crea la asignación variante-sucursal si no existe
- `syncStockSalePrice`: sincroniza precio de venta en todos los StockLocations al actualizar variante

### Stock Adjustment (Fase 3A)
- Servicio dedicado `StockAdjustmentService` con transacción atómica
- Crea movimiento de tipo `ADJUSTMENT` con `previousQuantity` y `newQuantity`
- Crea o actualiza `StockLocation` en la misma transacción
- Alerta automática si el ajuste supera el 20% del stock total
- Historial filtrable por variante y sucursal
- Roles restringidos: solo `root` y `gerente_general`

### Orders (Remitos)
- Estados: `DRAFT → SENT_TO_CASH → APPROVED / PARTIALLY_APPROVED / REJECTED → COMPLETED`
- Revisión en caja con aprobación parcial por ítem y manejo de stock pendiente
- Entrega parcial: múltiples eventos de entrega, reserva consumida por delta
- Cola de caja: remitos enviados a caja con stock disponible enriquecido en tiempo real
- Entregas pendientes: remitos pagos con entrega incompleta
- Modo estricto por sucursal: bloquea remitos con stock pendiente
- Generación de número de remito único con retry
- Métricas de venta por vendedor
- Lógica de negocio robusta: `buildStockExceededMessage`, `isStrictStockBranch`
- `FinalizeSaleUseCase`: caso de uso separado para finalizar en caja

### Payments
- Registro de pago con lock pesimista sobre la orden (`pessimistic_write`)
- Integración atómica con caja (movimiento INCOME) y ledger (syncOrderDebt)
- Reversión de pago: revierte ledger, anula asiento original, registra egreso en caja (abierta o nueva)
- Validación de monto pendiente vs pago solicitado
- Soporte para `current_account` (cuenta corriente) sin requerir pago total
- `registerForOrderFinalizationTx`: método transaccional para uso desde FinalizeSaleUseCase

### Account / Cuenta Corriente (Fase 3B)
- `AccountLedgerService`: libro mayor con idempotencia por clave compuesta
- Secuencia por sucursal (`branchScopedSequence`) para trazabilidad
- Balance acumulado por cliente/sucursal (`balanceAfter`)
- Validación de orden temporal de movimientos
- `syncOrderDebt`: crea automáticamente el débito y crédito al finalizar un remito
- `reversePayment`: reversión completa (ledger + anulación asiento + caja)
- `AccountAdjustmentsService`: ajustes manuales con autorización
- `AccountStatementService`: estado de cuenta del cliente con saldo actual
- `ensureCustomerBelongsToBranch`: valida que el cliente pertenezca a la sucursal activa

### Cash
- Apertura y cierre de caja por sucursal
- Cierre automático de cajas viejas al operar en un nuevo día
- `getOrCreateOperationalRegisterTx`: crea o recupera la caja operativa dentro de una transacción
- Integración con gastos, pagos, compras y reversiones

### Remitos (Documentos)
- Dos tipos: `CUMULATIVE` (estado completo del remito) y `DELIVERY_EVENT` (entrega puntual)
- Generación de PDF con PDFKit: datos de cliente, vendedor, sucursal, ítems entregados y pendientes, resumen financiero, firmas
- Ocultamiento de precios en remitos sin cobro registrado
- Filtros por sucursal, venta, orden y cliente

### Sales
- Creadas automáticamente al finalizar un remito en caja
- Idempotencia: no crea duplicados si ya existe una venta para la orden
- Estado calculado desde fulfillment + payment status de la orden
- `SaleItem` con snapshot de producto, SKU, precios y cantidades
- Tipos de plan de pago: `CASH`, `CURRENT_ACCOUNT`, `MIXED`

### Price Rules
- Reglas por marca o categoría con rango de fechas
- Aplicación única por regla (`appliedAt` evita reaplicación)
- Registro en historial de precios con fuente `rule`

### Price History
- Registro de cada cambio con precio anterior, nuevo, fuente (`manual` / `rule` / `system`) y usuario

### Customers
- Asignación a sucursal activa (no multi-sucursal por UI)
- Búsqueda por nombre, documento y teléfono
- Paginación opcional con backward compatibility
- Soft delete lógico

### Expenses
- Gastos fijos y variables con integración automática a caja como movimiento EXPENSE
- Asociación opcional a proveedor

---

## Módulos en Progreso

### Reports
- **Implementado:** reportes financieros (ingresos/egresos/balance con tendencias vs período anterior), movimientos de caja, ganancia, resumen diario, historial de precios, stock summary, ventas por producto/categoría/marca
- **Pendiente:** los reportes de ventas (`getSalesByProducts`, `getSalesByCategories`, `getSalesByBrands`) dependen de la entidad `Sale` y `SaleItem` — si el flujo de finalización no genera ventas correctamente, estos reportes devuelven vacío. Requiere validación end-to-end.
- **Pendiente:** reporte de ganancia es alias de finance report; falta implementar margen real (precio venta vs costo).

### Purchase
- Registro de compras por proveedor con aumento de stock y egreso de caja
- **Pendiente:** el stock se registra como movimiento genérico en `StockMovement` pero no actualiza `StockLocation`. El stock real no cambia. Requiere integración con `StockService.createStockLocation` o `adjustStock`.
- **Pendiente:** sin paginación ni filtros por sucursal en listado.

### Suppliers
- CRUD completo de proveedores y productos de proveedor
- `StockService` y `CashService` están inyectados pero no se usan en ningún método actual (imports muertos del refactor)
- **Pendiente:** integración real con flujo de compras y stock

---

## Seguridad y Permisos

### Roles
| Rol | Descripción |
|-----|-------------|
| `root` | Acceso total, sin restricciones |
| `gerente_general` | Acceso multi-sucursal si tiene `canViewAllBranches` |
| `gerente_sucursal` | Acceso a su sucursal únicamente |
| `vendedor` | Operación de ventas y productos |
| `cajero` | Caja, stock de lectura, ventas de lectura |

### Branch Scope
Todos los módulos operativos usan `resolveBranchScope` y `ensureBranchAccess` del utilitario `branch-scope.util`. El scope se resuelve desde el token JWT (`activeBranchId`, `hasAllBranchAccess`, `allowedBranchIds`).

### Matriz de permisos relevante

| Operación | root | ger_general | ger_sucursal | vendedor | cajero |
|-----------|------|-------------|--------------|----------|--------|
| Ajuste inventario | ✅ | ✅ | ❌ | ❌ | ❌ |
| Eliminar mov. stock | ✅ | ❌ | ❌ | ❌ | ❌ |
| Reportes financieros | ✅ | ✅ | ✅ | ❌ | ❌ |
| Importar productos | ✅ | ✅ | ✅ | ❌ | ❌ |
| Crear/transferir stock | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver stock summary | ✅ | ✅ | ✅ | ✅ | ❌ |
| Resumen diario | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reversar pagos | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## Base de Datos

### Configuración
```typescript
{
  type: 'postgres',
  synchronize: true,           // OK en desarrollo
  dropSchema: process.env.TYPEORM_DROP_SCHEMA === 'true'
}
```

### Entidades principales
- `User`, `Role`, `Branch`, `BranchUser`
- `Category`, `Brand`, `ProductsBase`, `ProductVariant`, `ProductVariantBranch`, `ProductImage`
- `StockLocation`, `StockMovement`, `StockTransfer`, `StockAlert`
- `Order`, `OrderItem`, `OrderDeliveryEvent`, `OrderDeliveryEventItem`
- `Sale`, `SaleItem`
- `Remito`, `RemitoItem`
- `Payment`, `CashRegister`, `CashMovement`
- `AccountEntry`, `AccountAdjustment`
- `Customer`, `CustomerBranch`
- `FixedExpense`, `VariableExpense`
- `PriceRule`, `PriceChangeHistory`
- `Purchase`, `PurchaseItem`
- `Supplier`, `SupplierProduct`

---

## Variables de Entorno

### Backend (Render)
```env
DATABASE_URL=
JWT_SECRET=
CORS_ORIGINS=
TYPEORM_DROP_SCHEMA=false
ROOT_EMAIL=
ROOT_PASSWORD=
```

### Frontend (Vercel)
```env
NEXT_PUBLIC_API_URL=
```

---

## Problemas Conocidos

| Módulo | Problema | Estado |
|--------|----------|--------|
| `Purchase` | Stock no se actualiza en `StockLocation` | Pendiente |
| `Suppliers` | `StockService` y `CashService` inyectados sin uso | Pendiente limpieza |
| `Reports` | Reportes de ventas dependen de que `Sale` se genere correctamente | Requiere validación |
| `Reports` | Ganancia = finanzas, sin margen real implementado | Pendiente |
| `Categories` | `findInactive` y `restore` no expuestos en controller | Pendiente |
| General | `synchronize: true` en producción — pendiente migrar a migraciones controladas | Pendiente |
| General | Logs sin formato estructurado | Pendiente |

---

## Pendientes para Producción

- [ ] Desactivar `synchronize: true` y activar migraciones TypeORM
- [ ] Logger estructurado por módulo con nivel, acción y userId
- [ ] Integrar stock real en módulo `Purchase`
- [ ] Limpiar imports muertos en `SuppliersService`
- [ ] Validar flujo completo de generación de `Sale` y su impacto en reportes
- [ ] Implementar margen real en reporte de ganancia
- [ ] Exponer `findInactive` y `restore` en `CategoriesController`
- [ ] Tests de integración en flujos críticos: finalización de remito, reversión de pago, ajuste de stock

---

## Comandos

```bash
# Backend
npm run start:dev
npm run build
npm run start:prod
npm run lint

# Reset de schema (solo desarrollo)
# Setear TYPEORM_DROP_SCHEMA=true y reiniciar

# Frontend
npm run dev
npm run build
npm run start
```

---

**Última actualización:** Julio 2026
**Próxima revisión:** Post integración de Purchase con StockLocation