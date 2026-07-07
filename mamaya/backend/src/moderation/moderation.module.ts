import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { ModerationAiService } from './moderation-ai.service';
import { ModerationProcessor } from './moderation.processor';
import { ReportsController } from './reports.controller';

@Module({
  imports: [BullModule.registerQueue({ name: 'moderation' }), AuthModule],
  controllers: [ReportsController],
  providers: [ModerationAiService, ModerationProcessor],
})
export class ModerationModule {}
