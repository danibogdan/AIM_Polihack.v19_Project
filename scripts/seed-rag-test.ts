import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import OpenAI from 'openai';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
const TEST_EMAIL = 'rag-test@serviceops.dev';
const TEST_PASSWORD = 'parola1234';

const INCIDENTS = [
  {
    title: 'Vibrații motor Carrier 30XA, etaj 3',
    description: 'Motorul central de pe etajul 3 prezintă vibrații puternice la pornire. Rulmentul frontal uzat după 8 ani de funcționare.',
    problem: 'Vibrații și zgomot la pornirea motorului',
    cause: 'Rulment frontal uzat, joc excesiv pe ax',
    solution: 'Înlocuire rulment SKF 6205 2RS. Verificare aliniere arbore. Ungere lagăre.',
    prevention: 'Inspecție rulmenți la 6 luni. Verificare vibrații cu analizor lunar.',
    severity: 'medium', machineBrand: 'Carrier', machineModel: '30XA', machineType: 'HVAC', machineYear: 2016,
    canonicalAction: 'bearing_check',
  },
  {
    title: 'Presiune joasă refrigerant Trane RTAF, clădirea B',
    description: 'Chiller-ul Trane semnalează alarmă de presiune joasă. Micro-scurgere la supapa Schrader după intervenție anterioară.',
    problem: 'Alarmă P-LOW, chiller oprire de urgență',
    cause: 'Scurgere micro la supapa Schrader, pierdere treptată de refrigerant R134a',
    solution: 'Înlocuire supapă Schrader. Reîncărcare refrigerant 2.4 kg R134a. Test etanșeitate 24h.',
    prevention: 'Verificare etanșeitate după orice intervenție la circuit frigorific.',
    severity: 'high', machineBrand: 'Trane', machineModel: 'RTAF', machineType: 'chiller', machineYear: 2018,
    canonicalAction: 'diagnostic_scan',
  },
  {
    title: 'Ușă lift Otis Gen2, reversie intermitentă etajele 10-14',
    description: 'Ușa liftului face reversia fără obstacol vizibil. Problema apare aleatoriu la etajele 10-14, mai ales dimineața.',
    problem: 'Reversia ușii fără cauză aparentă, mai frecvent la temperaturi scăzute',
    cause: 'Foto-celulă desaliniată cu 3mm după lucrări HVAC în zona puțului. Condensul afectează senzorul.',
    solution: 'Realiniere foto-celulă transmițător/receptor. Curățare lentile cu izopropanol 90%. 10 cicluri test.',
    prevention: 'Verificare aliniere după orice lucrare în zona puțului liftului.',
    severity: 'medium', machineBrand: 'Otis', machineModel: 'Gen2', machineType: 'elevator', machineYear: 2019,
    canonicalAction: 'diagnostic_scan',
  },
  {
    title: 'Consum ulei excesiv compresor Atlas Copco GA55',
    description: 'Compresorul consumă ulei vizibil între schimburi. Filtru separator colmatat, scurgere pe garnitura capacului.',
    problem: 'Consum ulei 0.5L/zi, semnal separator colmatat pe panou',
    cause: 'Filtru separator de ulei depășit (18 luni față de 12 recomandat). Garnitură capac deteriorată termic.',
    solution: 'Înlocuire filtru separator OEM 1614727400. Înlocuire garnitură capac. Completare ulei Roto-Inject Fluid 5L.',
    prevention: 'Schimb filtru separator la 12 luni indiferent de ore de funcționare.',
    severity: 'medium', machineBrand: 'Atlas Copco', machineModel: 'GA55', machineType: 'compresor', machineYear: 2020,
    canonicalAction: 'oil_check_replace',
  },
  {
    title: 'Starter motor Grundfos CR32 nu pornește',
    description: 'Pompa de circulație de la centrala termică nu pornește la comandă. Contactorul principal nu anclanșează.',
    problem: 'Pompa nu răspunde la comandă auto sau manuală',
    cause: 'Contactor principal CR1-D50 deteriorat, arc de contact oxidat. Suprafețele de contact arse.',
    solution: 'Înlocuire contactor Schneider LC1D50. Verificare circuit comandă 24VDC. Test pornire la sarcină.',
    prevention: 'Inspecție vizuală contactoare la revizia anuală. Curățare cu spray contact.',
    severity: 'high', machineBrand: 'Grundfos', machineModel: 'CR32', machineType: 'pompa', machineYear: 2017,
    canonicalAction: 'diagnostic_scan',
  },
  {
    title: 'Zgomot la rece motor Kone Monospace, parcare subsol',
    description: 'La prima pornire dimineața se aude un zgomot metalic de 2-3 secunde, apoi dispare. Apare doar sub 10°C.',
    problem: 'Zgomot metalic scurt la prima pornire pe vreme rece',
    cause: 'Joc termic pe cuplajul elastic. La temperaturi scăzute elastomerul cuplajului se contractă.',
    solution: 'Înlocuire insert elastomeric cuplaj. Aplicare spray antiîngheț pe carcasă motor.',
    prevention: 'Verificare cuplaj elastic anual. Menținere temperatură subsol minim 12°C iarna.',
    severity: 'low', machineBrand: 'Kone', machineModel: 'Monospace', machineType: 'elevator', machineYear: 2015,
    canonicalAction: 'bearing_check',
  },
];

function getSchemaName(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  return parsed.searchParams.get('schema') ?? 'public';
}

function buildEmbeddingText(inc: (typeof INCIDENTS)[0]): string {
  return [
    inc.title,
    inc.description,
    `Problema: ${inc.problem}`,
    `Cauza: ${inc.cause}`,
    `Soluție: ${inc.solution}`,
    `Echipament: ${inc.machineBrand} ${inc.machineModel} ${inc.machineType}`,
  ].join(' | ');
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL lipsește din .env');

  const schema = getSchemaName(databaseUrl);

  const pgClient = new Client({ connectionString: databaseUrl });
  await pgClient.connect();

  try {
    await pgClient.query(`SET search_path TO "${schema}", public`);
    await pgClient.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('✅ pgvector activat (schema:', schema, ')\n');
    await run(pgClient, schema);
  } finally {
    await pgClient.end();
  }
}

async function run(pgClient: Client, schema: string) {

  // ── 1. User ──────────────────────────────────────────────────
  let user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (!user) {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    user = await prisma.user.create({
      data: { email: TEST_EMAIL, passwordHash, name: 'RAG Tester', emailVerified: true, gdprConsent: true },
    });
    console.log('✅ User creat:', TEST_EMAIL);
  } else {
    console.log('ℹ️  User existent:', TEST_EMAIL);
  }

  // ── 2. Company + Team ─────────────────────────────────────────
  let team = await prisma.team.findFirst({ where: { members: { some: { userId: user.id } } } });
  if (!team) {
    const company = await prisma.company.create({ data: { name: 'ServiceOps Test SRL' } });
    team = await prisma.team.create({
      data: {
        name: 'Echipa Tehnică Test',
        companyId: company.id,
        members: { create: { userId: user.id, role: 'admin' } },
      },
    });
    console.log('✅ Echipă creată:', team.name, '| ID:', team.id);
  } else {
    console.log('ℹ️  Echipă existentă:', team.name, '| ID:', team.id);
  }

  // ── 3. Job ────────────────────────────────────────────────────
  let job = await prisma.job.findFirst({ where: { teamId: team.id } });
  if (!job) {
    job = await prisma.job.create({ data: { teamId: team.id, title: 'Job test RAG seed', status: 'completed' } });
    console.log('✅ Job creat\n');
  }

  // ── 4. Incidente + embeddings ─────────────────────────────────
  console.log('⚙️  Generez embeddings prin OpenAI...\n');

  for (const inc of INCIDENTS) {
    const existing = await prisma.incident.findFirst({ where: { teamId: team.id, title: inc.title } });
    if (existing) {
      console.log(`  ⏭️  Skip (există): ${inc.title}`);
      continue;
    }

    const embeddingText = buildEmbeddingText(inc);

    const incident = await prisma.incident.create({
      data: {
        teamId: team.id, jobId: job.id,
        title: inc.title, description: inc.description,
        problem: inc.problem, cause: inc.cause, solution: inc.solution, prevention: inc.prevention,
        severity: inc.severity, machineBrand: inc.machineBrand, machineModel: inc.machineModel,
        machineType: inc.machineType, machineYear: inc.machineYear,
        canonicalAction: inc.canonicalAction, embeddingText,
      },
    });

    const embResponse = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: embeddingText });
    const vector = embResponse.data[0]?.embedding;
    if (!vector) throw new Error('Embedding gol de la OpenAI');

    // Insert vectorial prin pg Client (cu search_path corect)
    await pgClient.query(
      `INSERT INTO "${schema}"."IncidentEmbedding" (id, "incidentId", "teamId", model, embedding, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4::vector, NOW(), NOW())`,
      [incident.id, team.id, EMBEDDING_MODEL, `[${vector.join(',')}]`],
    );

    console.log(`  ✅ ${inc.title}`);
  }

  // ── 5. Asociere toți userii existenți la echipă ──────────────
  const allUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  let added = 0;
  for (const u of allUsers) {
    const exists = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: u.id, teamId: team.id } },
    });
    if (!exists) {
      await prisma.teamMember.create({ data: { userId: u.id, teamId: team.id, role: 'member' } });
      console.log('  👤 User asociat la echipă');
      added++;
    }
  }
  if (added === 0) console.log('  ℹ️  Toți userii erau deja în echipă');

  console.log('\n─────────────────────────────────────────');
  console.log('🎉 Seed complet!\n');
  console.log(`  teamId: ${team.id}`);
  console.log(`  Toți userii din DB sunt acum în echipa: ${team.name}`);
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((e) => { console.error('❌ Eroare seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
