import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  CreateDateColumn
} from 'typeorm';
import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { User } from 'src/users/entities/user.entity';
import { PurchaseItem } from './purchase-item.entity';

@Entity({ name: 'purchases' })
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.purchases)
  supplier: Supplier;

  @ManyToOne(() => User, (user) => user.purchases)
  user: User;

  @OneToMany(() => PurchaseItem, (item) => item.purchase, { cascade: true })
  items: PurchaseItem[];

  @Column('decimal')
  total: number;

  @Column({ nullable: true })
  invoiceNumber?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;
}
