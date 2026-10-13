-- AlterTable
ALTER TABLE "AllianceClient" ADD COLUMN     "opportunityId" TEXT;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "initiativeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AllianceClient_opportunityId_key" ON "AllianceClient"("opportunityId");

-- AddForeignKey
ALTER TABLE "AllianceClient" ADD CONSTRAINT "AllianceClient_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

