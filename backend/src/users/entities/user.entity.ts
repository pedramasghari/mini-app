import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRole = 'USER' | 'ADMIN';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'bigint',
    unique: true,
  })
  telegramId!: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  username!: string | null;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  firstName!: string | null;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  lastName!: string | null;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  photoUrl!: string | null;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  languageCode!: string | null;

  @Column({
    type: 'varchar',
    default: 'USER',
  })
  role!: UserRole;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
