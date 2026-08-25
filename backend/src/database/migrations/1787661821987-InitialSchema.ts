import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1787661821987 implements MigrationInterface {
    name = 'InitialSchema1787661821987'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "support_messages" ALTER COLUMN "attachments" SET DEFAULT '[]'::jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "support_messages" ALTER COLUMN "attachments" SET DEFAULT '[]'`);
    }

}
