import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { CardsModule } from './cards/cards.module';
import { CardRequest } from './cards/entities/card-request.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL') ?? 'info',
          transport:
            config.get<string>('LOG_PRETTY') === 'true'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          autoLogging: { ignore: (req) => req.url === '/health' },
          serializers: {
            req: (req) => ({ method: req.method, url: req.url }),
            res: (res) => ({ statusCode: res.statusCode }),
          },
        },
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'better-sqlite3',
        database: config.get<string>('SQLITE_PATH') ?? './data/card-issuer.sqlite',
        entities: [CardRequest],
        synchronize: true,
      }),
    }),
    CardsModule,
  ],
})
export class AppModule {}
