import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsString } from 'class-validator';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import {
  AuthenticatedUser,
  CurrentUser,
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_BYTES = 5 * 1024 * 1024; // 5 Mo décodés par photo

class UploadMediaDto {
  @IsIn([...ALLOWED_MIMES])
  mime: (typeof ALLOWED_MIMES)[number];

  /** Contenu du fichier en base64 (l'app compresse avant envoi). */
  @IsString()
  dataBase64: string;
}

/**
 * Upload/lecture des photos (posts).
 * V1 sans S3 : blobs en base — voir migrations/0003_media_blobs.sql.
 */
@Controller({ path: 'media', version: '1' })
export class MediaController {
  constructor(private readonly dataSource: DataSource) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 40, ttl: 3600_000 } }) // 40 photos/h
  async upload(@CurrentUser() user: AuthenticatedUser, @Body() dto: UploadMediaDto) {
    const bytes = Buffer.from(dto.dataBase64, 'base64');
    if (bytes.length === 0 || bytes.length > MAX_BYTES) {
      throw new BadRequestException({ code: 'media/invalid_size' });
    }
    const [row] = await this.dataSource.query(
      `INSERT INTO media_blobs (owner_id, mime, bytes) VALUES ($1, $2, $3) RETURNING id`,
      [user.id, dto.mime, bytes],
    );
    return { key: row.id };
  }

  /**
   * Lecture SANS authentification : le composant <Image> de React Native
   * n'envoie pas le JWT. L'id UUID aléatoire sert de « capability URL »
   * (non devinable) — acceptable en V1, CDN signé prévu en production.
   */
  @Get(':id')
  async serve(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const [row] = await this.dataSource.query(
      `SELECT mime, bytes FROM media_blobs WHERE id = $1`,
      [id],
    );
    if (!row) throw new NotFoundException();
    res
      .setHeader('Content-Type', row.mime)
      .setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      .send(row.bytes);
  }
}
