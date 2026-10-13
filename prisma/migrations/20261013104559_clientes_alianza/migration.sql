-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('PROSPECTO', 'ACTIVO', 'INACTIVO');

-- CreateTable
CREATE TABLE "AllianceClient" (
    "id" TEXT NOT NULL,
    "allianceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'PROSPECTO',
    "revenue" DECIMAL(14,2),
    "since" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllianceClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AllianceClientToOffering" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AllianceClientToOffering_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllianceClient_allianceId_organizationId_key" ON "AllianceClient"("allianceId", "organizationId");

-- CreateIndex
CREATE INDEX "_AllianceClientToOffering_B_index" ON "_AllianceClientToOffering"("B");

-- AddForeignKey
ALTER TABLE "AllianceClient" ADD CONSTRAINT "AllianceClient_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllianceClient" ADD CONSTRAINT "AllianceClient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AllianceClientToOffering" ADD CONSTRAINT "_AllianceClientToOffering_A_fkey" FOREIGN KEY ("A") REFERENCES "AllianceClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AllianceClientToOffering" ADD CONSTRAINT "_AllianceClientToOffering_B_fkey" FOREIGN KEY ("B") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
