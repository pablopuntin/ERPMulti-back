import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:5173'];

  // app.enableCors({
  //   origin: (origin, callback) => {
  //     if (!origin || allowedOrigins.includes(origin)) {
  //       callback(null, true);
  //     } else {
  //       callback(new Error(`CORS: origin not allowed — ${origin}`));
  //     }
  //   },
  //   credentials: true,
  //   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
  // });

//   // Temporalmente más permisivo en local para que no te trabe el desarrollo
// app.enableCors({
//   origin: true, // 👈 Permite cualquier origen que haga la petición (ideal para pruebas locales)
//   credentials: true,
//   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
// });



  // Habilitar CORS para permitir que Vercel se conecte a Render
  app.enableCors({
    origin: [
      'https://erp-multi-front.vercel.app', // URL de producción de Vercel
          ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // elimina propiedades que no estén en el DTO
      forbidNonWhitelisted: false, // no lanza error si llegan propiedades extra
      transform: true // convierte el body a instancia del DTO
    })
  );

  const config = new DocumentBuilder()
    .setTitle('Business Management API')
    .setDescription(
      'REST API desarrollada con NestJS para la gestión de productos, ventas, clientes, caja, cuentas corrientes y administración de sucursales.'
    )
    .setVersion('1.0.0')
    .addBearerAuth() // 👈 usa el esquema por defecto "bearer"
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/swagger', app, document);

  //await app.listen(process.env.PORT ?? 3000);
  const port = process.env.PORT || 4000;
await app.listen(port);

console.log(`🚀 App running on port ${port}`);
  
}
bootstrap();
