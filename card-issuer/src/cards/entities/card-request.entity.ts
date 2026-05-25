import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CardRequestStatus = 'PENDING' | 'ISSUED' | 'FAILED';

@Entity({ name: 'card_requests' })
export class CardRequest {
  @PrimaryColumn({ name: 'request_id', type: 'varchar', length: 36 })
  requestId!: string;

  @Index({ unique: true })
  @Column({ name: 'document_number', type: 'varchar', length: 16 })
  documentNumber!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName!: string;

  @Column({ type: 'varchar', length: 120 })
  email!: string;

  @Column({ type: 'int' })
  age!: number;

  @Column({ name: 'product_type', type: 'varchar', length: 20 })
  productType!: string;

  @Column({ name: 'product_currency', type: 'varchar', length: 3 })
  productCurrency!: string;

  @Column({ name: 'force_error', type: 'boolean', default: false })
  forceError!: boolean;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status!: CardRequestStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
