import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import { createAdapter } from '@socket.io/redis-adapter';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createClient } from 'redis';
import { ServerOptions } from 'socket.io';
import { AppModule } from './app.module';
import { TokenService } from './auth/token.service';

/** Adapter Socket.IO branché sur Redis → la gateway WS scale sur N instances. */
class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // En-têtes durcis (Étape 4) — l'API ne sert pas de HTML, CSP minimale
  app.use(helmet());
  app.enableCors({ origin: false }); // API mobile : pas de CORS navigateur

  app.enableVersioning({ type: VersioningType.URI, prefix: 'v' });

  // Clés EdDSA de signature des JWT (env/KMS)
  await app.get(TokenService).init({
    kid: process.env.JWT_KID ?? 'k1',
    privatePem: process.env.JWT_PRIVATE_PEM ?? '',
    publicPems: { [process.env.JWT_KID ?? 'k1']: process.env.JWT_PUBLIC_PEM ?? '' },
  });

  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis();
  app.useWebSocketAdapter(redisAdapter);

  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
