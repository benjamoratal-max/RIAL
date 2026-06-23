/**
 * Crea la tabla PushSubscription en la base local usando la conexión que ya funciona
 * (el proxy prisma+postgres del dev server). Workaround porque `prisma db push` no
 * acepta el esquema prisma+postgres como directUrl. En producción usar `prisma db push`.
 * Idempotente: se puede correr varias veces.
 */
import prisma from '../src/lib/prisma';

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PushSubscription" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "endpoint" TEXT NOT NULL,
      "p256dh" TEXT NOT NULL,
      "auth" TEXT NOT NULL,
      "userAgent" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");`
  );
  // FK a User (ignora si ya existe).
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "PushSubscription"
        ADD CONSTRAINT "PushSubscription_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "PushSubscription";`);
  console.log('PushSubscription OK ->', JSON.stringify(rows));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('ERROR', e?.message || e);
    process.exit(1);
  });
