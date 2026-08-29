import { MigrationInterface, QueryRunner } from 'typeorm';

export class ZibalPaymentGuards1788000000000 implements MigrationInterface {
  name = 'ZibalPaymentGuards1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_zibal_pending_user"
      ON "zibal_payments" ("userId")
      WHERE "status" = 'PENDING'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_zibal_pending_user"`);
  }
}
