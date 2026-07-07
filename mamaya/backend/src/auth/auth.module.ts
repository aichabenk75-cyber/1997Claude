import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoModule } from '../crypto/crypto.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BruteForceService } from './brute-force.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OAuthService } from './oauth.service';
import { RefreshToken } from './refresh-token.entity';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';

/**
 * Module d'authentification.
 * Les providers ci-dessous à brancher via des factories de config :
 *  - TokenService.init()  : clés EdDSA (kid + PEM) depuis l'env/KMS ;
 *  - OAuthService         : client IDs Google (iOS/Android) + bundle ID Apple ;
 *  - BruteForceService / AuthService : connexion Redis (ioredis) partagée.
 */
@Module({
  imports: [TypeOrmModule.forFeature([RefreshToken]), UsersModule, CryptoModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    TotpService,
    OAuthService,
    BruteForceService,
    JwtAuthGuard,
  ],
  exports: [TokenService, JwtAuthGuard],
})
export class AuthModule {}
