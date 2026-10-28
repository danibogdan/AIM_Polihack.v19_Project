-- CreateTable
CREATE TABLE "process_flows" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "nodesJson" JSONB NOT NULL DEFAULT '[]',
    "edgesJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_flows_pkey" PRIMARY KEY ("id")
);
