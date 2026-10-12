-- CreateEnum
CREATE TYPE "Dimension" AS ENUM ('GOBERNANZA', 'ESTRATEGIA', 'PRODUCTO', 'VENTAS');

-- AlterTable
ALTER TABLE "Alliance" ADD COLUMN     "dimension" "Dimension" NOT NULL DEFAULT 'ESTRATEGIA';

-- AlterTable
ALTER TABLE "Initiative" ADD COLUMN     "dimension" "Dimension" NOT NULL DEFAULT 'ESTRATEGIA';

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "dimension" "Dimension" NOT NULL DEFAULT 'VENTAS';
