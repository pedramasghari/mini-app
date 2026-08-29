import { MigrationInterface, QueryRunner } from 'typeorm';

export class ZibalManualVerifyGuards1788001000000 implements MigrationInterface {
  name = 'ZibalManualVerifyGuards1788001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zibal_payments"
      ADD COLUMN IF NOT EXISTS "lastVerifyAt" TIMESTAMPTZ NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_wallet_tx_zibal_payment_deposit"
      ON "wallet_transactions" ("referenceType", "referenceId")
      WHERE "type" = 'DEPOSIT'
        AND "referenceType" = 'ZIBAL_PAYMENT'
        AND "referenceId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_wallet_tx_zibal_payment_deposit"`);
    await queryRunner.query(`ALTER TABLE "zibal_payments" DROP COLUMN IF EXISTS "lastVerifyAt"`);
  }
}
