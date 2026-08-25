import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.getOrThrow<string>('DATABASE_HOST'),
        port: config.get<number>('DATABASE_PORT', 5432),
        username: config.getOrThrow<string>('DATABASE_USER'),
        password: config.getOrThrow<string>('DATABASE_PASSWORD'),
        database: config.getOrThrow<string>('DATABASE_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: config.get('DATABASE_MIGRATIONS_RUN', 'false') === 'true',
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        logging: config.get('DATABASE_LOGGING', 'false') === 'true',
      }),
    }),
  ],
})
export class DatabaseModule {}
