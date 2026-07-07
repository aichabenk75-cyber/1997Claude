import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Comment, Reaction } from './comment.entity';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { Poll, PollOption, Post, PostMedia } from './post.entity';
import { PostsService } from './posts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, PostMedia, Poll, PollOption, Comment, Reaction]),
    BullModule.registerQueue({ name: 'moderation' }),
    AuthModule,
  ],
  controllers: [FeedController],
  providers: [FeedService, PostsService],
})
export class FeedModule {}
