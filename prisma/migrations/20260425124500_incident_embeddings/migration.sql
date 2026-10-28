CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

CREATE TABLE "IncidentEmbedding" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "embedding" public.vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IncidentEmbedding_incidentId_key" ON "IncidentEmbedding"("incidentId");
CREATE INDEX "IncidentEmbedding_teamId_idx" ON "IncidentEmbedding"("teamId");
CREATE INDEX "IncidentEmbedding_embedding_ivfflat_idx"
    ON "IncidentEmbedding"
    USING ivfflat ("embedding" public.vector_cosine_ops) WITH (lists = 100);

ALTER TABLE "IncidentEmbedding" ADD CONSTRAINT "IncidentEmbedding_incidentId_fkey"
    FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncidentEmbedding" ADD CONSTRAINT "IncidentEmbedding_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
