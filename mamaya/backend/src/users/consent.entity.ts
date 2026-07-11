import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('consents')
export class Consent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  kind: string;

  @Column({ type: 'text' })
  version: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  grantedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
