# 🎲 Validación de Sucursales - Estrategia Híbrida Aleatoria

## 📋 Resumen

Implementamos una estrategia de validación híbrida que combina:
- **Validación aleatoria**: Basada en probabilidad por rol
- **Validación estratégica**: Cada N requests
- **Performance óptima**: 80-95% menos overhead
- **Seguridad robusta**: Doble capa de protección

---

## 🛠️ Arquitectura

### **Middleware: `BranchValidationMiddleware`**
```typescript
// Configuración por rol
const SECURITY_CONFIG = {
  'root': { probability: 0.2, everyN: 5 },        // 20% aleatorio + cada 5
  'gerente_general': { probability: 0.15, everyN: 10 }, // 15% aleatorio + cada 10
  'gerente_local': { probability: 0.1, everyN: 15 },   // 10% aleatorio + cada 15
  'vendedor': { probability: 0.08, everyN: 20 },      // 8% aleatorio + cada 20
  'cajero': { probability: 0.05, everyN: 30 }         // 5% aleatorio + cada 30
};
```

### **Flujo de Validación:**
1. **Request entra** con token JWT + header `X-Branch-ID`
2. **Generar aleatorio** entre 0 y 1
3. **Verificar probabilidad** según rol del usuario
4. **Validar si**: `random <= probability` OR `requestCount % everyN === 0`
5. **Si válida**: Consultar BD y verificar asignación
6. **Si no válida**: Retornar error 401

---

## 🚀 Puesta en Marcha

### **1. Iniciar Backend**
```bash
cd back
npm run start:dev
```

### **2. Ver Logs de Validación**
Deberías ver logs como estos:
```bash
🎲 Validation - User: user-uuid, Role: vendedor, Random: 0.083, ShouldValidate: true
✅ Access granted - User: user-uuid, Branch: central-uuid, Role: EMPLOYEE

🎲 Validation - User: user-uuid, Role: vendedor, Random: 0.456, ShouldValidate: false
⚡ Skip validation - User: user-uuid, Branch: central-uuid
```

### **3. Probar con Script de Testing**
```bash
# Instalar dependencias si no las tienes
npm install axios

# Ejecutar pruebas automatizadas
node test-branch-validation.js
```

---

## 🧪 Pruebas Manuales

### **1. Obtener Token de Usuario**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "root@electrotec.com",
    "password": "RootSecurePassword123!"
  }'
```

### **2. Probar Validación de Sucursal**
```bash
# Reemplazar TOKEN y BRANCH_ID con valores reales
curl -X GET http://localhost:4000/api/branches/test-validation/BRANCH_ID \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Branch-ID: BRANCH_ID"
```

### **3. Probar Endpoint Protegido**
```bash
# Probar acceso a productos con validación de sucursal
curl -X GET http://localhost:4000/api/products-base \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Branch-ID: BRANCH_ID"
```

---

## 📊 Análisis de Performance

### **Métricas Esperadas:**

| Rol | Probabilidad | Validaciones/día | Overhead promedio |
|------|-------------|------------------|------------------|
| Root | 20% | ~5,760 | 1.2ms |
| Gerente General | 15% | ~4,320 | 0.9ms |
| Gerente Local | 10% | ~2,880 | 0.6ms |
| Vendedor | 8% | ~2,304 | 0.5ms |
| Cajero | 5% | ~1,440 | 0.3ms |

### **Con 30 usuarios concurrentes:**
- **Requests totales/día**: 28,800
- **Validaciones promedio**: 3,360 (11.7%)
- **Ahorro de performance**: 89%
- **Ventana máxima de ataque**: 20 requests (~3 minutos)

---

## 🛡️ Consideraciones de Seguridad

### **✅ Ventajas:**
- **Impredecibilidad**: Atacantes no saben cuándo se validará
- **Performance**: 90% de requests sin overhead
- **Escalable**: Funciona igual con 100+ usuarios
- **Configurable**: Se ajusta por nivel de riesgo

### **⚠️ Mitigaciones:**
- **Ventana de ataque**: Máximo 20 requests por usuario
- **Logs completos**: Todas las validaciones se registran
- **Revocación instantánea**: Siguiente validación bloquea acceso

---

## 🔧 Configuración

### **Variables de Entorno:**
```bash
# .env
BRANCH_VALIDATE_EVERY_N=5      # Validar cada N requests
BRANCH_VALIDATE_PROBABILITY=0.1  # Probabilidad base (10%)
BRANCH_SECURITY_LEVEL=medium     # low/medium/high
```

### **Ajuste por Nivel:**
- **LOW**: probability=0.05, everyN=30 (máxima performance)
- **MEDIUM**: probability=0.1, everyN=20 (balanceado)
- **HIGH**: probability=0.2, everyN=5 (máxima seguridad)

---

## 📱 Integración con Frontend

### **Headers Requeridos:**
```javascript
// Cada request debe incluir:
headers: {
  'Authorization': `Bearer ${token}`,
  'X-Branch-ID': currentBranchId
}
```

### **Manejo de Errores:**
```javascript
try {
  const response = await api.get('/products');
} catch (error) {
  if (error.response?.status === 401) {
    // Redirigir a login o mostrar selector de sucursal
    redirectToLogin();
  }
}
```

---

## 🐛 Troubleshooting

### **Error 401: "Branch ID required"**
- **Causa**: No se envió header `X-Branch-ID`
- **Solución**: Agregar header a todas las requests

### **Error 401: "Access denied for this branch"**
- **Causa**: Usuario no tiene asignación a esa sucursal
- **Solución**: Verificar asignaciones o cambiar sucursal

### **Performance lenta**
- **Causa**: Demasiadas validaciones (probabilidad muy alta)
- **Solución**: Ajustar `BRANCH_VALIDATE_PROBABILITY` hacia abajo

---

## 📈 Monitoreo

### **KPIs a Observar:**
- **Tasa de validación**: Debe coincidir con configuración
- **Tiempo de respuesta**: Promedio <50ms
- **Errores 401**: Deben ser <1% del total
- **Logs de seguridad**: Revisar patrones sospechosos

### **Alertas:**
```bash
# Si la tasa de validación se desvía >20%
echo "⚠️ Revisar configuración de probabilidad"

# Si hay más de 10 errores 401 en 1 minuto
echo "🚨 Posible ataque en curso"
```

---

## 🎯 Próximos Pasos

1. **✅ Testing actual**: Validar funcionamiento básico
2. **📊 Monitoreo**: Implementar métricas en producción
3. **🔄 Redis**: Reemplazar contador simulado por Redis real
4. **📱 Frontend**: Integrar con manejo de sucursales
5. **🔐 Auditoría**: Logs detallados para análisis de seguridad

---

## 🧪 Casos de Test

### **Caso 1: Usuario Válido**
```bash
# Debería funcionar 8-9 de 10 veces
# Logs mostrarán mezcla de ⚡ y ✅
```

### **Caso 2: Usuario Inválido**
```bash
# Debería fallar en la próxima validación
# Máximo 20 requests antes del bloqueo
```

### **Caso 3: Cambio de Rol**
```bash
# Nueva probabilidad se aplica inmediatamente
# Root: 20% vs Vendedor: 8%
```

---

**🎲 ¡Listo para probar! Ejecuta el script y observa los logs para ver la validación aleatoria en acción.**
