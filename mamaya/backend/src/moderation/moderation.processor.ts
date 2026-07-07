import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { ModerationAiService } from './moderation-ai.service';

interface ClassifyJob {
  targetType: 'post' | 'comment';
  targetId: string;
}

/**
 * Pipeline de modération automatique (asynchrone, hors requête) :
 *   ① blocklist de mots (regex, sévérité 'bloquer' → rejet immédiat)
 *   ② classification IA (texte + photos)
 *   ③ écriture du verdict + traçabilité dans moderation_actions
 * Un contenu 'en_attente' reste visible par son autrice seulement ;
 * il n'est jamais amplifié avant approbation.
 */
@Processor('moderation')
export class ModerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ModerationProcessor.name);
  private blocklistCache: { patterns: { re: RegExp; severity: string }[]; at: number } | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly ai: ModerationAiService,
  ) {
    super();
  }

  async process(job: Job<ClassifyJob>): Promise<void> {
    const { targetType, targetId } = job.data;
    const table = targetType === 'post' ? 'posts' : 'comments';

    const [row] = await this.dataSource.query(
      `SELECT body FROM ${table} WHERE id = $1 AND deleted_at IS NULL`,
      [targetId],
    );
    if (!row) return; // supprimé entre-temps

    // ① Blocklist — rapide, locale, avant tout appel réseau
    const blocked = await this.matchBlocklist(row.body ?? '');
    if (blocked === 'bloquer') {
      await this.applyVerdict(table, targetType, targetId, 'rejete', 'ia', 'Blocklist');
      return;
    }

    // ② Photos éventuelles → URLs présignées de courte durée pour l'analyse
    const imageUrls =
      targetType === 'post' ? await this.presignPostMedia(targetId) : [];

    // ③ Classification IA
    const result = await this.ai.classify(row.body, imageUrls);
    const verdict =
      blocked === 'revue' && result.verdict === 'approuve'
        ? 'revue_humaine' // la blocklist 'revue' force au minimum la revue
        : result.verdict;

    await this.applyVerdict(
      table,
      targetType,
      targetId,
      verdict,
      'ia',
      `${result.categories.join(',')} — ${result.raison}`.slice(0, 500),
    );
  }

  private async applyVerdict(
    table: string,
    targetType: string,
    targetId: string,
    verdict: string,
    actor: string,
    reason: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      await em.query(
        `UPDATE ${table} SET moderation = $2 WHERE id = $1`,
        [targetId, verdict === 'rejete' ? 'rejete' : verdict === 'approuve' ? 'approuve' : 'revue_humaine'],
      );
      await em.query(
        `INSERT INTO moderation_actions (target_type, target_id, actor, action, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [targetType, targetId, actor, verdict, reason],
      );
    });
    this.logger.log(`${targetType} ${targetId} → ${verdict}`);
  }

  /** Blocklist compilée et mise en cache 5 min. */
  private async matchBlocklist(text: string): Promise<'bloquer' | 'revue' | null> {
    if (!this.blocklistCache || Date.now() - this.blocklistCache.at > 300_000) {
      const rows = await this.dataSource.query(
        `SELECT pattern, severity FROM banned_words`,
      );
      this.blocklistCache = {
        at: Date.now(),
        patterns: rows.map((r: { pattern: string; severity: string }) => ({
          re: new RegExp(r.pattern, 'iu'),
          severity: r.severity,
        })),
      };
    }
    let worst: 'bloquer' | 'revue' | null = null;
    for (const { re, severity } of this.blocklistCache.patterns) {
      if (re.test(text)) {
        if (severity === 'bloquer') return 'bloquer';
        worst = 'revue';
      }
    }
    return worst;
  }

  /** URLs S3 présignées (15 min) des médias du post — implémentation dans le module storage. */
  private async presignPostMedia(postId: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT s3_key FROM post_media WHERE post_id = $1 ORDER BY position`,
      [postId],
    );
    // storageService.presign(s3Key) — branché via le module storage
    return rows.map((r: { s3_key: string }) => r.s3_key);
  }
}
