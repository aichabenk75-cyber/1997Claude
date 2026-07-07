import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  AuthenticatedUser,
  CurrentUser,
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard';
import { GeoService } from './geo.service';

class UpdateLocationDto {
  @IsNumber() @Min(-90) @Max(90)
  lat: number;

  @IsNumber() @Min(-180) @Max(180)
  lng: number;
}

class GhostModeDto {
  @IsBoolean()
  enabled: boolean;
}

class NearbyQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(2) @Max(50)
  radius_km?: number;

  // tranche d'âge du/des enfants, ex. '0-6m', '6-24m'
  @IsOptional() @IsIn(['0-6m', '6-24m', '2-4a', '4a-plus'])
  child_age?: string;

  @IsOptional() @IsString()
  interests?: string; // slugs séparés par des virgules
}

const CHILD_AGE_RANGES: Record<string, { minMonths: number; maxMonths: number }> = {
  '0-6m': { minMonths: 0, maxMonths: 6 },
  '6-24m': { minMonths: 6, maxMonths: 24 },
  '2-4a': { minMonths: 24, maxMonths: 48 },
  '4a-plus': { minMonths: 48, maxMonths: 300 },
};

@Controller({ version: '1' })
@UseGuards(JwtAuthGuard)
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  /** Le mobile envoie sa position exacte ; le floutage a lieu ICI, avant stockage. */
  @Put('me/location')
  @HttpCode(204)
  @Throttle({ default: { limit: 6, ttl: 3600_000 } }) // 6/h
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateLocationDto) {
    return this.geo.updateLocation(user.id, dto.lat, dto.lng);
  }

  @Delete('me/location')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser) {
    return this.geo.deleteLocation(user.id);
  }

  @Patch('me/location/ghost-mode')
  @HttpCode(204)
  ghost(@CurrentUser() user: AuthenticatedUser, @Body() dto: GhostModeDto) {
    return this.geo.setGhostMode(user.id, dto.enabled);
  }

  @Get('nearby')
  @Throttle({ default: { limit: 20, ttl: 3600_000 } }) // 20/h — anti-trilatération
  async nearby(@CurrentUser() user: AuthenticatedUser, @Query() q: NearbyQueryDto) {
    const data = await this.geo.findNearby(user.id, {
      radiusKm: q.radius_km ?? 10,
      childAgeRange: q.child_age ? CHILD_AGE_RANGES[q.child_age] : undefined,
      interests: q.interests?.split(',').filter(Boolean),
    });
    return { data };
  }
}
