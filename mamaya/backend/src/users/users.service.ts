import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { EnvelopeCryptoService } from '../crypto/envelope-crypto.service';
import { RegisterDto } from './dto/register.dto';
import { AuthProvider, User, UserStatus } from './user.entity';
import { UserProfile } from './user-profile.entity';
import { Child } from './child.entity';

// Paramètres Argon2id — mémoire 64 Mio / 3 itérations / parallélisme 4.
// À recalibrer annuellement (cible : ~100 ms par hachage sur le matériel de prod).
const ARGON2_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024,
  timeCost: 3,
  parallelism: 4,
};

const PURGE_DELAY_DAYS = 30;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly crypto: EnvelopeCryptoService,
  ) {}

  /** Inscription email + mot de passe. Consentements tracés dans la même transaction. */
  async register(dto: RegisterDto): Promise<User> {
    const passwordHash = await argon2.hash(dto.password, ARGON2_OPTS);

    return this.dataSource.transaction(async (em) => {
      const existing = await em.findOne(User, { where: { email: dto.email }, withDeleted: true });
      if (existing) {
        // Message générique côté controller (anti-énumération d'emails).
        throw new ConflictException({ code: 'auth/registration_failed' });
      }

      const user = em.create(User, {
        email: dto.email,
        passwordHash,
        provider: AuthProvider.EMAIL,
        status: dto.status,
        dueDate: dto.status === UserStatus.ENCEINTE ? dto.dueDate : null,
      });
      await em.save(user);

      await em.save(
        em.create(UserProfile, {
          userId: user.id,
          displayName: dto.displayName,
          cityLabel: dto.cityLabel ?? null,
        }),
      );

      // Consentements horodatés + versionnés (RGPD : preuve du recueil).
      const consents = [{ userId: user.id, kind: 'cgu', version: dto.cguVersion }];
      if (dto.consentHealthDataVersion) {
        consents.push({ userId: user.id, kind: 'sante', version: dto.consentHealthDataVersion });
      }
      await em.getRepository('consents').insert(consents);

      return user;
    });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  findByProvider(provider: AuthProvider, providerSub: string): Promise<User | null> {
    return this.users.findOneBy({ provider, providerSub });
  }

  /** Création de compte à la première connexion OAuth (token déjà vérifié). */
  async createFromOAuth(input: {
    provider: AuthProvider;
    providerSub: string;
    email: string;
    emailVerified: boolean;
    displayName: string;
    status: UserStatus;
    dueDate: string | null;
    cguVersion: string;
  }): Promise<User> {
    return this.dataSource.transaction(async (em) => {
      const user = em.create(User, {
        email: input.email,
        passwordHash: null, // pas de mot de passe : OAuth uniquement
        provider: input.provider,
        providerSub: input.providerSub,
        emailVerifiedAt: input.emailVerified ? new Date() : null,
        status: input.status,
        dueDate: input.dueDate,
      });
      await em.save(user);
      await em.save(
        em.create(UserProfile, { userId: user.id, displayName: input.displayName }),
      );
      await em.getRepository('consents').insert([
        { userId: user.id, kind: 'cgu', version: input.cguVersion },
      ]);
      return user;
    });
  }

  /** Vérification en temps constant ; ne révèle jamais si l'email existe. */
  async verifyCredentials(email: string, password: string): Promise<User> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne();

    // Hachage factice si compte inconnu → durée de réponse identique.
    const hash =
      user?.passwordHash ??
      '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const ok = await argon2.verify(hash, password).catch(() => false);

    if (!user || !ok) {
      throw new UnauthorizedException({ code: 'auth/invalid_credentials' });
    }
    return user;
  }

  /** Ajout d'un enfant : prénom + date exacte chiffrés, seul le mois reste en clair. */
  async addChild(userId: string, firstName: string | null, birthdate: string): Promise<Child> {
    const birthMonth = `${birthdate.slice(0, 7)}-01`;
    const child = this.dataSource.getRepository(Child).create({
      userId,
      birthMonth,
      firstNameEnc: firstName
        ? await this.crypto.encryptForUser(userId, 'child.first_name', firstName)
        : null,
      birthdateEnc: await this.crypto.encryptForUser(userId, 'child.birthdate', birthdate),
    });
    return this.dataSource.getRepository(Child).save(child);
  }

  /**
   * Suppression « en un clic » (RGPD) :
   * soft delete immédiat + révocation des sessions + purge planifiée à J+30.
   * La purge détruit l'EDK → crypto-shredding de toutes les données P0.
   */
  async requestDeletion(userId: string): Promise<{ purgeAfter: Date }> {
    const purgeAfter = new Date(Date.now() + PURGE_DELAY_DAYS * 24 * 3600 * 1000);

    await this.dataSource.transaction(async (em) => {
      await em.softDelete(User, userId); // invisible partout dès maintenant
      await em.getRepository('deletion_requests').upsert(
        { userId, purgeAfter },
        ['userId'],
      );
      // Position effacée immédiatement (pas d'attente J+30 pour la géoloc).
      await em.getRepository('user_locations').delete({ userId });
      // Refresh tokens révoqués → déconnexion de tous les appareils.
      await em.getRepository('refresh_tokens').delete({ userId });
    });

    this.crypto.evictUser(userId);
    return { purgeAfter };
  }
}
