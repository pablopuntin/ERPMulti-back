import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  BeforeInsert,
  BeforeUpdate,
  OneToMany,
  DeleteDateColumn
} from 'typeorm';
import { Role } from './role.entity';
import { BadRequestException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Order } from '../../orders/entities/order.entity';
import { Purchase } from 'src/purchase/entities/purchase.entity';
import { BranchUser } from '../../branches/entities/branch-user.entity';

@Entity('users')
export class User {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Identificador único del usuario (UUID)'
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'Juan',
    description: 'Nombre del usuario'
  })
  @Column()
  firstname: string;

  @ApiProperty({
    example: 'Pérez',
    description: 'Apellido del usuario'
  })
  @Column()
  lastname: string;

  @ApiProperty({
    example: 'juan.perez@example.com',
    description: 'Correo electrónico único del usuario'
  })
  @Column({ unique: true })
  email: string;

  @ApiProperty({
    example: 'hashed_password_123',
    description: 'Contraseña del usuario'
  })
  @Column()
  password: string;

  @ApiProperty({
    example: true,
    description: 'Indica si el usuario está activo en el sistema'
  })
  @Column({ default: true })
  isActive: boolean;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;

  @ApiProperty({
    type: () => [Role],
    description: 'Lista de roles asociados al usuario'
  })
  @ManyToMany(() => Role, (role) => role.users, { eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' }
  })
  roles: Role[];

  // ✅ Una marca tiene muchos productos base
  @OneToMany(() => Order, (order) => order.user)
  order: Order[];

  @BeforeInsert()
  @BeforeUpdate()
  validateAuthFields() {
    if (!this.password) {
      throw new BadRequestException(
        'User must have a password for internal auth'
      );
    }
  }

  @OneToMany(() => Purchase, (purchase) => purchase.user)
  purchases: Purchase[];

  @OneToMany(() => BranchUser, (branchUser) => branchUser.user)
  branchAssignments: BranchUser[];
}
