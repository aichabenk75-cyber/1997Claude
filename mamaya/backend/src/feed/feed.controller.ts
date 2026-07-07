import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post as HttpPost,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  AuthenticatedUser,
  CurrentUser,
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard';
import { CreateCommentDto, CreatePostDto, FeedQueryDto } from './dto/create-post.dto';
import { FeedService } from './feed.service';
import { PostsService } from './posts.service';
import { ReactionTarget } from './comment.entity';

@Controller({ version: '1' })
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(
    private readonly feed: FeedService,
    private readonly posts: PostsService,
  ) {}

  @Get('feed')
  getFeed(@CurrentUser() user: AuthenticatedUser, @Query() q: FeedQueryDto) {
    return this.feed.getFeed(user.id, q.mode ?? 'algo', q.cursor);
  }

  @HttpPost('posts')
  @Throttle({ default: { limit: 10, ttl: 3600_000 } }) // 10 posts/h
  async createPost(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePostDto) {
    const post = await this.posts.createPost(user.id, dto);
    // en_attente : visible par l'autrice seule tant que la modération n'a pas statué
    return { id: post.id, moderation: post.moderation };
  }

  @Delete('posts/:id')
  @HttpCode(204)
  deletePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.posts.deletePost(user.id, id, user.role !== 'member');
  }

  @HttpPost('posts/:id/comments')
  @Throttle({ default: { limit: 30, ttl: 3600_000 } }) // 30 commentaires/h
  async addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    const comment = await this.posts.addComment(user.id, postId, dto);
    return { id: comment.id, moderation: comment.moderation };
  }

  @Put('posts/:id/reactions')
  @HttpCode(204)
  react(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.posts.setReaction(user.id, ReactionTarget.POST, id, true);
  }

  @Delete('posts/:id/reactions')
  @HttpCode(204)
  unreact(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.posts.setReaction(user.id, ReactionTarget.POST, id, false);
  }

  @HttpPost('posts/:id/votes')
  @HttpCode(204)
  vote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
    @Body('option_id', ParseUUIDPipe) optionId: string,
  ) {
    return this.posts.votePoll(user.id, postId, optionId);
  }
}
