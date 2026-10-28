import 'dotenv/config';
import { Client } from 'pg';

function getSchemaName(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  const schema = parsed.searchParams.get('schema') ?? 'public';

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error(`Invalid schema name in DATABASE_URL: ${schema}`);
  }

  return schema;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL in environment.');
  }

  const schema = getSchemaName(databaseUrl);
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);

    await client.query('CREATE EXTENSION IF NOT EXISTS vector');

    const extensionCheck = await client.query<{
      extname: string;
      extversion: string;
    }>('SELECT extname, extversion FROM pg_extension WHERE extname = $1', [
      'vector',
    ]);

    if (extensionCheck.rowCount === 0) {
      throw new Error('pgvector extension is not installed.');
    }

    await client.query('DROP TABLE IF EXISTS vector_smoke_test');
    await client.query(
      'CREATE TABLE vector_smoke_test (id serial PRIMARY KEY, label text NOT NULL, embedding vector(3) NOT NULL)',
    );

    await client.query(
      `INSERT INTO vector_smoke_test (label, embedding)
       VALUES
       ('engine-check', '[0.92,0.06,0.02]'),
       ('oil-check', '[0.20,0.75,0.05]'),
       ('tire-check', '[0.10,0.10,0.80]')`,
    );

    const nearest = await client.query<{
      label: string;
      distance: number;
    }>(
      `SELECT label, embedding <-> '[0.90,0.08,0.02]'::vector AS distance
       FROM vector_smoke_test
       ORDER BY embedding <-> '[0.90,0.08,0.02]'::vector
       LIMIT 1`,
    );

    const top = nearest.rows[0];

    if (!top) {
      throw new Error('Vector query returned no rows.');
    }

    console.log('Vector DB test passed.');
    console.log(
      `Nearest label: ${top.label} (distance: ${top.distance.toFixed(6)})`,
    );
    console.log(
      `pgvector version: ${extensionCheck.rows[0].extversion} | schema: ${schema}`,
    );
  } finally {
    await client.query('DROP TABLE IF EXISTS vector_smoke_test');
    await client.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Vector DB test failed.');
  console.error(message);

  if (message.includes('extension "vector" is not available')) {
    console.error('Install pgvector in your PostgreSQL instance, then retry.');
    console.error('macOS (Homebrew): brew install pgvector');
    console.error(
      'Then enable it in DB: CREATE EXTENSION IF NOT EXISTS vector;',
    );
  }

  process.exit(1);
});
