import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // app.enableCors({
  //   origin: ['http://localhost:3000'], // frontend local
  //   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  //   credentials: true
  // });

  app.enableCors({
  origin: true,
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
    .setTitle('Electrotec API')
    .setDescription(
      'API desarrollada con NestJS — autenticación, roles y módulos dinámicos para Electrotec.'
    )
    .setVersion('1.0.0')
    .addBearerAuth() // 👈 usa el esquema por defecto "bearer"
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/swagger', app, document);

  //await app.listen(process.env.PORT ?? 3000);
  const port = process.env.PORT || 3000;
await app.listen(port);

console.log(`🚀 App running on port ${port}`);
  
}
bootstrap();
