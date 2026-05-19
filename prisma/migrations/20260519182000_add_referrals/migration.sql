ALTER TABLE "User" ADD COLUMN "referrerId" TEXT;
CREATE INDEX "User_referrerId_idx" ON "User"("referrerId");
ALTER TABLE "User" ADD CONSTRAINT "User_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
