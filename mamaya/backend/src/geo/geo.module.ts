import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';
import { DataSource } from 'typeorm';

@Module({
  imports: [AuthModule],
  controllers: [GeoController],
  providers: [
    {
      provide: GeoService,
      useFactory: (dataSource: DataSource) =>
        // Secret dédié au jitter — distinct des clés JWT (env/KMS)
        new GeoService(dataSource, process.env.GEO_JITTER_SECRET ?? ''),
      inject: [DataSource],
    },
  ],
})
export class GeoModule {}
