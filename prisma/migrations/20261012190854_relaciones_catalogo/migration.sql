-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('LIDER', 'SOCIO', 'PROVEEDOR', 'CLIENTE', 'CANAL', 'INTEGRADOR', 'FINANCIADOR', 'INSTITUCIONAL', 'OTRO');

-- CreateEnum
CREATE TYPE "OfferingKind" AS ENUM ('PRODUCTO', 'SERVICIO', 'OTRO');

-- AlterTable
ALTER TABLE "AllianceParticipant" ADD COLUMN     "roleType" "ParticipantRole" NOT NULL DEFAULT 'SOCIO';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "parentId" TEXT;

-- CreateTable
CREATE TABLE "Offering" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "OfferingKind" NOT NULL DEFAULT 'PRODUCTO',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AllianceToOffering" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AllianceToOffering_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_OfferingToOrganization" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_OfferingToOrganization_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AllianceToOffering_B_index" ON "_AllianceToOffering"("B");

-- CreateIndex
CREATE INDEX "_OfferingToOrganization_B_index" ON "_OfferingToOrganization"("B");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AllianceToOffering" ADD CONSTRAINT "_AllianceToOffering_A_fkey" FOREIGN KEY ("A") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AllianceToOffering" ADD CONSTRAINT "_AllianceToOffering_B_fkey" FOREIGN KEY ("B") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OfferingToOrganization" ADD CONSTRAINT "_OfferingToOrganization_A_fkey" FOREIGN KEY ("A") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OfferingToOrganization" ADD CONSTRAINT "_OfferingToOrganization_B_fkey" FOREIGN KEY ("B") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
