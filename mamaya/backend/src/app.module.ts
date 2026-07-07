import { Module } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { CryptoModule } from './crypto/crypto.module';
import { FeedModule } from './feed/feed.module';
import { GeoModule } from './geo/geo.module';
import { ModerationModule } from './moderation/moderation.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      // Jamais de synchronize en prod : le schéma vient des migrations SQL.
      synchronize: false,
    }),
    BullModule.forRoot({
      connection: { url: process.env.REDIS_URL },
    }),
    // Garde-fou global : 60 req/min — les endpoints sensibles resserrent via @Throttle
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    CryptoModule,
    UsersModule,
    AuthModule,
    FeedModule,
    GeoModule,
    ChatModule,
    ModerationModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      // Validation stricte partout : champ inconnu → 400 (whitelist)
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    },
  ],
})
export class AppModule {}
