import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export type AiVerdict = 'approuve' | 'revue_humaine' | 'rejete';

export interface AiModerationResult {
  verdict: AiVerdict;
  categories: string[];
  raison: string;
}

// Structured outputs : la réponse est CONTRAINTE à ce schéma — pas de parsing
// fragile de texte libre. (additionalProperties:false + required exigés.)
const MODERATION_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['approuve', 'revue_humaine', 'rejete'] },
    categories: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'harcelement',
          'haine',
          'sexualisation',
          'danger_enfant',
          'desinformation_medicale',
          'violence',
          'spam_commercial',
          'donnees_personnelles',
          'autre',
        ],
      },
    },
    raison: { type: 'string' },
  },
  required: ['verdict', 'categories', 'raison'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Tu es le modérateur automatique de Mamaya, un réseau social \
français pour mères et futures mères (dont des adolescentes). La bienveillance de la \
communauté est le pilier du produit ; la prudence prime.

Classe le contenu soumis :
- "approuve" : bienveillant ou anodin (entraide, questions, récits, humour).
- "rejete" : clairement inacceptable — harcèlement, haine, sexualisation, mise en \
danger d'un enfant, spam commercial manifeste.
- "revue_humaine" : ambigu, ou sensible même de bonne foi — détresse psychologique, \
conseil médical potentiellement dangereux (ex. remède contre-indiqué pendant la \
grossesse), données personnelles identifiantes (adresse, école d'un enfant), conflit \
entre membres.

Important : les discussions crues mais légitimes entre mères (allaitement, corps, \
accouchement, sexualité post-partum) sont NORMALES ici → "approuve". \
Dans le doute → "revue_humaine", jamais "rejete".`;

/**
 * Classification IA (texte + photos) via l'API Claude.
 * Appelée uniquement depuis la file BullMQ — jamais dans le fil d'une requête.
 */
@Injectable()
export class ModerationAiService {
  private readonly logger = new Logger(ModerationAiService.name);
  private readonly client = new Anthropic(); // ANTHROPIC_API_KEY via l'environnement

  /**
   * @param text  contenu textuel du post/commentaire
   * @param imageUrls URLs S3 présignées (courtes durées) des photos éventuelles
   */
  async classify(text: string | null, imageUrls: string[] = []): Promise<AiModerationResult> {
    const content: Anthropic.ContentBlockParam[] = [
      ...imageUrls.map((url): Anthropic.ImageBlockParam => ({
        type: 'image',
        source: { type: 'url', url },
      })),
      {
        type: 'text',
        text: `Contenu à modérer :\n<contenu>\n${text ?? '(photo sans texte)'}\n</contenu>`,
      },
    ];

    try {
      const response = await this.client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            // Prompt stable + appels fréquents → cache (~90 % d'économie)
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [
          {
            name: 'classer_contenu',
            description: 'Classe le contenu modéré selon le schéma imposé.',
            input_schema: MODERATION_SCHEMA as unknown as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'classer_contenu' },
        messages: [{ role: 'user', content }],
      });

      const toolBlock = response.content.find((b) => b.type === 'tool_use');
      if (!toolBlock || toolBlock.type !== 'tool_use') {
        throw new Error('Réponse sans appel d’outil');
      }
      return toolBlock.input as AiModerationResult;
    } catch (err) {
      // Fail-safe : en cas d'erreur API on n'approuve JAMAIS automatiquement.
      this.logger.error(`Classification échouée: ${err}`);
      return { verdict: 'revue_humaine', categories: ['autre'], raison: 'Erreur classification' };
    }
  }
}
