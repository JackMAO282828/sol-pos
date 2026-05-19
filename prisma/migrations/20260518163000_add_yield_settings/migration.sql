CREATE TABLE "YieldSetting" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dailyRate" DECIMAL(10,6) NOT NULL,
    "adminWallet" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YieldSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "YieldSetting_date_key" ON "YieldSetting"("date");
CREATE INDEX "YieldSetting_date_idx" ON "YieldSetting"("date");
