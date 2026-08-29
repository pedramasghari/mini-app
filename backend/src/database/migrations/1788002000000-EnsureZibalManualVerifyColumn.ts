import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Defensive migration for deployments where the manual-verify migration was
 * already recorded as executed before lastVerifyAt existed in the database.
 */
export class EnsureZibalManualVerifyColumn1788002000000 implements MigrationInterface {
  name = 'EnsureZibalManualVerifyColumn1788002000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zibal_payments"
      ADD COLUMN IF NOT EXISTS "lastVerifyAt" TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zibal_payments"
      DROP COLUMN IF EXISTS "lastVerifyAt"
    `);
  }
}
