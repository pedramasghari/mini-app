import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Final defensive migration for existing production databases.
 *
 * Some deployments may already have a previous Zibal manual-verify migration
 * recorded in the TypeORM migrations table while the physical column is still
 * missing. This migration is intentionally idempotent so it repairs that
 * state without touching existing payment data.
 */
export class EnsureZibalManualVerifyColumnFinal1788003000000 implements MigrationInterface {
  name = 'EnsureZibalManualVerifyColumnFinal1788003000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zibal_payments"
      ADD COLUMN IF NOT EXISTS "lastVerifyAt" TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Do not remove the column during rollback if an older migration may
    // still depend on it. The previous migration owns the destructive change.
  }
}
