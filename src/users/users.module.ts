import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { InitialSeeder } from 'src/common/seeds/seed.superadmin';
import { Branch } from 'src/branches/entities/branch.entity';
import { BranchUser } from 'src/branches/entities/branch-user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Branch, BranchUser])],
  controllers: [UsersController],
  providers: [UsersService, InitialSeeder],
  exports: [TypeOrmModule, UsersService]
})
export class UsersModule {}
