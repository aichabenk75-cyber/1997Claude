import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoModule } from '../crypto/crypto.module';
import { Child } from './child.entity';
import { Consent } from './consent.entity';
import { User } from './user.entity';
import { UserProfile } from './user-profile.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserProfile, Child, Consent]), CryptoModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
