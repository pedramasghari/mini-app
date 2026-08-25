import { MigrationInterface, QueryRunner } from 'typeorm';

export class SmsCodeTransactionGuards1787665000000 implements MigrationInterface {
  name = 'SmsCodeTransactionGuards1787665000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // One local SMSCode order may have exactly one debit transaction.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_smscode_order_debit_tx"
      ON "wallet_transactions" ("referenceType", "referenceId")
      WHERE "type" = 'SMSCODE_ORDER_DEBIT'
        AND "referenceType" = 'SMSCODE_ORDER'
        AND "referenceId" IS NOT NULL
    `);

    // One local SMSCode order may have exactly one refund transaction.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_smscode_order_refund_tx"
      ON "wallet_transactions" ("referenceType", "referenceId")
      WHERE "type" = 'SMSCODE_ORDER_REFUND'
        AND "referenceType" = 'SMSCODE_ORDER_REFUND'
        AND "referenceId" IS NOT NULL
    `);

    // A user can have only one active SMSCode order. This is the database-level
    // backstop for concurrent create requests/retries.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_active_sms_order_per_user"
      ON "smscode_orders" ("userId")
      WHERE "status" IN ('CREATING', 'PROVIDER_PENDING', 'ACTIVE', 'OTP_RECEIVED')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_active_sms_order_per_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_smscode_order_refund_tx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_smscode_order_debit_tx"`);
  }
}
