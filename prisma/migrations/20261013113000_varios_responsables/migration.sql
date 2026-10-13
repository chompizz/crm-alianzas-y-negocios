-- CreateTable
CREATE TABLE "_AllianceOwner" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

CONSTRAINT "_AllianceOwner_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_InitiativeOwner" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

CONSTRAINT "_InitiativeOwner_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CommitmentOwner" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

CONSTRAINT "_CommitmentOwner_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AllianceOwner_B_index" ON "_AllianceOwner"("B");

-- CreateIndex
CREATE INDEX "_InitiativeOwner_B_index" ON "_InitiativeOwner"("B");

-- CreateIndex
CREATE INDEX "_CommitmentOwner_B_index" ON "_CommitmentOwner"("B");

-- AddForeignKey
ALTER TABLE "_AllianceOwner" ADD CONSTRAINT "_AllianceOwner_A_fkey" FOREIGN KEY ("A") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AllianceOwner" ADD CONSTRAINT "_AllianceOwner_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InitiativeOwner" ADD CONSTRAINT "_InitiativeOwner_A_fkey" FOREIGN KEY ("A") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InitiativeOwner" ADD CONSTRAINT "_InitiativeOwner_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommitmentOwner" ADD CONSTRAINT "_CommitmentOwner_A_fkey" FOREIGN KEY ("A") REFERENCES "Commitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommitmentOwner" ADD CONSTRAINT "_CommitmentOwner_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Los responsables actuales pasan a la lista de responsables (no se pierde nada).
INSERT INTO "_AllianceOwner" ("A", "B") SELECT "id", "ownerId" FROM "Alliance" WHERE "ownerId" IS NOT NULL;
INSERT INTO "_InitiativeOwner" ("A", "B") SELECT "id", "ownerId" FROM "Initiative" WHERE "ownerId" IS NOT NULL;
INSERT INTO "_CommitmentOwner" ("A", "B") SELECT "id", "ownerId" FROM "Commitment" WHERE "ownerId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Alliance" DROP CONSTRAINT "Alliance_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Commitment" DROP CONSTRAINT "Commitment_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Initiative" DROP CONSTRAINT "Initiative_ownerId_fkey";

-- AlterTable
ALTER TABLE "Alliance" DROP COLUMN "ownerId";

-- AlterTable
ALTER TABLE "Commitment" DROP COLUMN "ownerId";

-- AlterTable
ALTER TABLE "Initiative" DROP COLUMN "ownerId";
