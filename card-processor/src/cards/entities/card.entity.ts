import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'cards' })
export class Card {
  @PrimaryColumn({ name: 'card_id', type: 'varchar', length: 36 })
  cardId!: string;

  @Index({ unique: true })
  @Column({ name: 'request_id', type: 'varchar', length: 36 })
  requestId!: string;

  @Column({ name: 'card_number', type: 'varchar', length: 19 })
  cardNumber!: string;

  @Column({ type: 'varchar', length: 5 })
  expiry!: string;

  @Column({ type: 'varchar', length: 4 })
  cvv!: string;

  @Column({ type: 'varchar', length: 120 })
  cardholder!: string;

  @Column({ name: 'product_type', type: 'varchar', length: 20 })
  productType!: string;

  @Column({ name: 'product_currency', type: 'varchar', length: 3 })
  productCurrency!: string;

  @Column({ type: 'varchar', length: 20, default: 'ISSUED' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
