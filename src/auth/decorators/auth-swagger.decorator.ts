import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';

/**
 * Decorador para marcar endpoints protegidos en Swagger.
 *
 * - Añade el esquema Bearer (JWT) a la documentación de la ruta.
 * - Muestra una descripción en caso de error 401.
 * - No afecta la lógica real de autenticación, solo documentación.
 */
export function AuthSwagger() {
  return applyDecorators(
    ApiBearerAuth(), // 👈 ahora coincide con el esquema por defecto
    ApiUnauthorizedResponse({
      description:
        'Debe incluir un token JWT válido en el encabezado Authorization.'
    })
  );
}
