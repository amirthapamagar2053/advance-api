-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('employee', 'supervisor', 'finance_manager', 'finance_director');

-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('Draft', 'Pending_Supervisor', 'Approved', 'Rejected', 'Returned');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('Pending_Review', 'Approved', 'Returned_for_Revision');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'employee',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "advanceRequestId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "totalUtilized" DECIMAL(12,2) NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'Pending_Review',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementExpense" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "expenseType" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "receiptUrl" TEXT NOT NULL,

    CONSTRAINT "SettlementExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalLog" (
    "id" TEXT NOT NULL,
    "advanceRequestId" TEXT,
    "settlementId" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceRequest_requestNumber_key" ON "AdvanceRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_referenceNumber_key" ON "Settlement"("referenceNumber");

-- AddForeignKey
ALTER TABLE "AdvanceRequest" ADD CONSTRAINT "AdvanceRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_advanceRequestId_fkey" FOREIGN KEY ("advanceRequestId") REFERENCES "AdvanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementExpense" ADD CONSTRAINT "SettlementExpense_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLog" ADD CONSTRAINT "ApprovalLog_advanceRequestId_fkey" FOREIGN KEY ("advanceRequestId") REFERENCES "AdvanceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLog" ADD CONSTRAINT "ApprovalLog_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLog" ADD CONSTRAINT "ApprovalLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE SEQUENCE advance_request_seq START 1000;
CREATE SEQUENCE settlement_seq START 3000;
