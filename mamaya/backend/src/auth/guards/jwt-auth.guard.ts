import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '../token.service';

export interface AuthenticatedUser {
  id: string;
  role: string;
}

/**
 * Guard global (sauf routes marquées @Public) : vérifie le JWT EdDSA et
 * attache { id, role } à la requête. Aucune requête en base ici — le token
 * court (15 min) et la révocation des refresh tokens bornent la fenêtre
 * d'un compte supprimé/banni.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException({ code: 'auth/missing_token' });

    const payload = await this.tokens.verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role } satisfies AuthenticatedUser;
    return true;
  }
}

/** Injecte l'utilisatrice authentifiée : `@CurrentUser() user: AuthenticatedUser`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser =>
    ctx.switchToHttp().getRequest().user,
);
