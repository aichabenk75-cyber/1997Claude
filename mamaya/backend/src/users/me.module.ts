import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MeController } from './me.controller';
import { UsersModule } from './users.module';

/**
 * Module séparé pour les routes /v1/me : UsersModule ne peut pas importer
 * AuthModule (qui l'importe déjà) sans cycle — ce module fait le pont.
 */
@Module({
  imports: [UsersModule, AuthModule],
  controllers: [MeController],
})
export class MeModule {}
