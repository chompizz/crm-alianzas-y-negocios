-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('EMPRESA', 'ONG', 'GOBIERNO', 'UNIVERSIDAD', 'FONDO', 'OTRO');

-- CreateEnum
CREATE TYPE "RelationshipLevel" AS ENUM ('FRIA', 'TIBIA', 'CERCANA');

-- CreateEnum
CREATE TYPE "AllianceType" AS ENUM ('COMERCIAL', 'TECNOLOGICA', 'INSTITUCIONAL', 'INVERSION', 'OTRA');

-- CreateEnum
CREATE TYPE "AllianceStage" AS ENUM ('EXPLORACION', 'EVALUACION', 'NEGOCIACION', 'ACTIVA', 'EN_REVISION', 'CERRADA');

-- CreateEnum
CREATE TYPE "Health" AS ENUM ('VERDE', 'AMARILLO', 'ROJO');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('ABIERTA', 'GANADA', 'DESCARTADA');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('REUNION', 'LLAMADA', 'EMAIL', 'EVENTO', 'NOTA');

-- CreateEnum
CREATE TYPE "CommitmentParty" AS ENUM ('NOSOTROS', 'SOCIO');

-- CreateEnum
CREATE TYPE "CommitmentStatus" AS ENUM ('PENDIENTE', 'CUMPLIDO', 'CANCELADO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'EMPRESA',
    "sector" TEXT,
    "website" TEXT,
    "description" TEXT,
    "capabilities" TEXT[],
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "relationshipLevel" "RelationshipLevel" NOT NULL DEFAULT 'TIBIA',
    "notes" TEXT,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alliance" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "type" "AllianceType" NOT NULL DEFAULT 'COMERCIAL',
    "stage" "AllianceStage" NOT NULL DEFAULT 'EXPLORACION',
    "health" "Health" NOT NULL DEFAULT 'VERDE',
    "objectives" TEXT,
    "expectedValue" DECIMAL(14,2),
    "startDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllianceParticipant" (
    "allianceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "AllianceParticipant_pkey" PRIMARY KEY ("allianceId","organizationId")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimatedValue" DECIMAL(14,2),
    "probability" INTEGER,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'ABIERTA',
    "allianceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Initiative" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Initiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,
    "initiativeId" TEXT NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "InteractionType" NOT NULL DEFAULT 'REUNION',
    "summary" TEXT NOT NULL,
    "allianceId" TEXT,
    "initiativeId" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commitment" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "party" "CommitmentParty" NOT NULL DEFAULT 'NOSOTROS',
    "status" "CommitmentStatus" NOT NULL DEFAULT 'PENDIENTE',
    "dueDate" TIMESTAMP(3),
    "ownerId" TEXT,
    "interactionId" TEXT,
    "allianceId" TEXT,
    "initiativeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CountryToOrganization" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CountryToOrganization_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ContactToInteraction" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContactToInteraction_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AllianceToInitiative" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AllianceToInitiative_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_InitiativeToOrganization" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InitiativeToOrganization_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "_CountryToOrganization_B_index" ON "_CountryToOrganization"("B");

-- CreateIndex
CREATE INDEX "_ContactToInteraction_B_index" ON "_ContactToInteraction"("B");

-- CreateIndex
CREATE INDEX "_AllianceToInitiative_B_index" ON "_AllianceToInitiative"("B");

-- CreateIndex
CREATE INDEX "_InitiativeToOrganization_B_index" ON "_InitiativeToOrganization"("B");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alliance" ADD CONSTRAINT "Alliance_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alliance" ADD CONSTRAINT "Alliance_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllianceParticipant" ADD CONSTRAINT "AllianceParticipant_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllianceParticipant" ADD CONSTRAINT "AllianceParticipant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "Interaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CountryToOrganization" ADD CONSTRAINT "_CountryToOrganization_A_fkey" FOREIGN KEY ("A") REFERENCES "Country"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CountryToOrganization" ADD CONSTRAINT "_CountryToOrganization_B_fkey" FOREIGN KEY ("B") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContactToInteraction" ADD CONSTRAINT "_ContactToInteraction_A_fkey" FOREIGN KEY ("A") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContactToInteraction" ADD CONSTRAINT "_ContactToInteraction_B_fkey" FOREIGN KEY ("B") REFERENCES "Interaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AllianceToInitiative" ADD CONSTRAINT "_AllianceToInitiative_A_fkey" FOREIGN KEY ("A") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AllianceToInitiative" ADD CONSTRAINT "_AllianceToInitiative_B_fkey" FOREIGN KEY ("B") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InitiativeToOrganization" ADD CONSTRAINT "_InitiativeToOrganization_A_fkey" FOREIGN KEY ("A") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InitiativeToOrganization" ADD CONSTRAINT "_InitiativeToOrganization_B_fkey" FOREIGN KEY ("B") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
