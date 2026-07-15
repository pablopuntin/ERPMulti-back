// src/config/typeorm.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';


export const getTypeOrmConfig = (
  config: ConfigService
): TypeOrmModuleOptions => {
  const databaseUrl = config.get<string>('DATABASE_URL');

  return {
    type: 'postgres',
    url: databaseUrl,

    ssl: databaseUrl
      ? {
          rejectUnauthorized: false,
        }
      : false,

    autoLoadEntities: true,
    synchronize: true, // OK en desarrollo
    dropSchema: config.get<string>('TYPEORM_DROP_SCHEMA') === 'false',
  };
};
