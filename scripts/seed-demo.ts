/**
 * Demo seed — HVAC Emergency Diagnostic use case
 * Creates: user, team, 12 rich incidents + embeddings, 1 process flow, 4 past jobs
 *
 * Run: npm run seed:demo
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import OpenAI from 'openai';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

const DEMO_EMAIL    = 'demo@serviceops.dev';
const DEMO_PASSWORD = 'Demo1234!';

// ─── 12 rich incidents covering every step of the HVAC diagnostic flow ───────

const INCIDENTS = [
  {
    title: 'LOTO neaplicat la chiller Carrier 30XA — incident de siguranță',
    description: 'Tehnicianul a pornit lucrul la compresor fără a aplica LOTO. Colegul a repornit instalația de la tablou în timp ce intervenția era în curs. Accident evitat la limită.',
    problem: 'Pornire neașteptată a echipamentului în timpul intervenției, risc electrocutare',
    cause: 'Lipsă procedură LOTO documentată pe fișa de lucru. Comunicare insuficientă între echipe.',
    solution: 'Oprire imediată, blocare fizică cu lacăt personal pe separator, etichetare "NU PORNIȚI — Intervenție în curs". Revizie proceduri de siguranță cu întreaga echipă.',
    prevention: 'LOTO obligatoriu documentat înainte de orice intervenție. Fișă semnată de toți membrii echipei prezente. Audit lunar al respectării procedurii.',
    severity: 'high', machineBrand: 'Carrier', machineModel: '30XA', machineType: 'chiller', machineYear: 2018,
    canonicalAction: 'loto_safety',
  },
  {
    title: 'EPI incomplet — arsuri chimice la reîncărcare refrigerant Trane',
    description: 'Tehnicianul nu purta mănuși criogenice la manipularea R134a lichid. Contact scurt cu refrigerantul a produs degerături superficiale pe dosul mâinii drepte.',
    problem: 'Degerături superficiale mână dreaptă din contact cu R134a lichid la -26°C',
    cause: 'EPI incomplet — lipsă mănuși criogenice și ochelari de protecție. Urgență percepută a dus la omiterea verificării echipamentului.',
    solution: 'Prim ajutor imediat (apă caldă 15 min, nu frecare). Raportare incident. Verificare și completare trusă EPI înainte de orice intervenție la circuit frigorific.',
    prevention: 'Check-list EPI obligatoriu la începutul fiecărei intervenții: mănuși criogenice, ochelari, șorț antiacid. Truse EPI verificate lunar.',
    severity: 'high', machineBrand: 'Trane', machineModel: 'RTAF', machineType: 'chiller', machineYear: 2019,
    canonicalAction: 'ppe_check',
  },
  {
    title: 'Alarmă P-LOW persistentă Carrier 30XA — cod eroare E03',
    description: 'Chiller-ul Carrier 30XA din centrala de pe etajul tehnic semnalizează E03 (presiune joasă aspirație) la fiecare 2-3 ore. Reset-ul rezolvă temporar problema, dar alarma revine.',
    problem: 'Cod eroare E03 P-LOW recurrent, chiller iese din funcțiune la fiecare 2-3h',
    cause: 'Micro-scurgere de refrigerant R410A la racordul flexibil de pe retur compresor. Pierdere estimată 80g/zi.',
    solution: 'Citire coduri de eroare cu Carrier Service Tool. Identificare scurgere cu detector electronic. Înlocuire racord flexibil 1/2". Reîncărcare 1.2kg R410A. Reset parametri presiune în controler. Test 24h.',
    prevention: 'Verificare etanșeitate cu detector la fiecare revizie semestrială. Log toate alarmele E03 pentru trend analysis.',
    severity: 'high', machineBrand: 'Carrier', machineModel: '30XA', machineType: 'chiller', machineYear: 2018,
    canonicalAction: 'fault_code_read',
  },
  {
    title: 'Presiune joasă refrigerant R134a — scurgere supapă Schrader, corp B',
    description: 'Chiller Trane RTAF oprire de urgență din cauza presiunii de aspirație sub 1.8 bar (limita 2.1 bar). Detectat în urma alarmei de noapte. Presiunea scăzuse de la 4.2 la 1.6 bar în 72h.',
    problem: 'Presiune aspirație sub limita de siguranță, oprire automată chiller, corp B fără răcire',
    cause: 'Scurgere la supapa Schrader de pe circuitul de joasă presiune. Garnitura supapei deteriorată la intervenția anterioară.',
    solution: 'Recuperare refrigerant rezidual. Înlocuire supapă Schrader 1/4" SAE. Vacuum 500 micron (30 min). Reîncărcare 3.6kg R134a gravimetric. Verificare subcooling/superheat. Test etanșeitate 48h cu azot.',
    prevention: 'Verificare etanșeitate obligatorie după orice intervenție la circuit. Înlocuire supape Schrader la fiecare revizie anuală.',
    severity: 'high', machineBrand: 'Trane', machineModel: 'RTAF', machineType: 'chiller', machineYear: 2019,
    canonicalAction: 'refrigerant_pressure_check',
  },
  {
    title: 'Freeze-up compresor Carrier 30XA — îngheț evaporator',
    description: 'Compresorul Carrier semnalizează temperatură de evaporare sub -5°C (limita -2°C). Evaporatorul parțial înghețat. Chiller oprit de urgență pentru a preveni avaria mecanică.',
    problem: 'Temperatură evaporare -7°C, îngheț parțial pe evaporator, risc avarie compresor',
    cause: 'Supapă de expansiune termostată blocată parțial închis din cauza umidității în circuit. Subcooling insuficient.',
    solution: 'Oprire și dezghețare naturală 4h (NU cu torță). Înlocuire filtru deshidratator. Verificare și recalibrare supapă TEV. Reglare subcooling la 5°C. Purjare umiditate din circuit.',
    prevention: 'Verificare filtru deshidratator la revizia anuală. Monitorizare temperatură evaporare în BMS. Alertă automată sub -1°C.',
    severity: 'high', machineBrand: 'Carrier', machineModel: '30XA', machineType: 'chiller', machineYear: 2018,
    canonicalAction: 'compressor_inspection',
  },
  {
    title: 'Consum ulei excesiv compresor scroll Carrier — filtru separator colmatat',
    description: 'Compresor Carrier 30XA consumă vizibil ulei. Nivelul în vizor a scăzut de la marcajul MAX la MIN în 3 săptămâni. Semnal galben pe panou de control — separator colmatat.',
    problem: 'Consum ulei 400ml/săptămână, nivel sub MIN în vizor, semnal separator colmatat',
    cause: 'Filtru separator de ulei depășit — 14 luni față de 12 luni recomandat. Particulele de ulei trec în circuitul de refrigerant, reducând eficiența și lubrifianța compresorului.',
    solution: 'Recuperare refrigerant. Înlocuire filtru separator OEM Carrier (P/N PP23-001). Completare ulei Carrier Refrigeration Oil 05 (1.5L). Reîncărcare refrigerant. Verificare vizor după 24h funcționare.',
    prevention: 'Schimb filtru separator la exact 12 luni, indiferent de ore. Verificare nivel ulei la fiecare vizită (lunar).',
    severity: 'medium', machineBrand: 'Carrier', machineModel: '30XA', machineType: 'chiller', machineYear: 2018,
    canonicalAction: 'oil_level_check',
  },
  {
    title: 'Serpentine condensator colmatate — eficiență în scădere cu 35%',
    description: 'Chiller-ul funcționează dar temperatura de condensare e cu 8°C peste valorile normale de sezon (48°C față de 40°C). Consum electric crescut cu 35%. Inspecție vizuală: serpentine parțial obturate cu praf și insecte.',
    problem: 'Temperatură condensare 48°C (normal 40°C), consum electric +35%, COP scăzut',
    cause: 'Serpentine condensator cu depuneri organice și praf — ultima curățare acum 18 luni (standard 6 luni în mediu urban).',
    solution: 'Curățare serpentine cu pompă de presiune joasă (max 2 bar, dinspre interior spre exterior). Aplicare degresant biodegradabil Coil-Kleen. Clătire cu apă demineralizată. Verificare aripioare îndoite (perie specială). Test parametri după 2h funcționare.',
    prevention: 'Curățare serpentine condensator la 6 luni în mediu urban, 12 luni în rural. Verificare vizuală lunară.',
    severity: 'medium', machineBrand: 'Carrier', machineModel: '30XA', machineType: 'chiller', machineYear: 2018,
    canonicalAction: 'condenser_inspection',
  },
  {
    title: 'Contactor principal ars — pompa chiller nu pornește',
    description: 'Pompa de agent termic a chiller-ului nu pornește la comandă auto sau manuală. Verificare tablou: contactorul principal LC1D65 prezintă suprafețele de contact carbonizate. Fum și miros de plastic ars la inspecție.',
    problem: 'Pompa nu pornește, contactor principal ars, lipsă agent termic la distribuție',
    cause: 'Contactor LC1D65 supraîncărcat din cauza pornirii frecvente sub sarcină mare. Arcul electric repetat a carbonizat suprafețele de contact. Durată de viață depășită — 8 ani față de 5 ani recomandat.',
    solution: 'Înlocuire contactor Schneider LC1D65A3 (verificare compatibilitate bobină 230V AC). Verificare și curățare contacte auxiliare. Verificare calibrare releu termic. Test pornire la gol și sub sarcină.',
    prevention: 'Înlocuire contactoare la 5 ani sau 500.000 cicluri. Verificare vizuală contacte la revizia anuală. Montare variatoare de frecvență pentru reducerea curentului de pornire.',
    severity: 'high', machineBrand: 'Schneider', machineModel: 'LC1D65', machineType: 'tablou_electric', machineYear: 2016,
    canonicalAction: 'electrical_inspection',
  },
  {
    title: 'Vibrații anormale compresor scroll — rulment deteriorat',
    description: 'Compresor Carrier 30XA prezintă vibrații care se simt fizic în sala tehnică. Analizor de vibrații arată 12 mm/s (limita 4.5 mm/s). Zgomot metalic la 120Hz. Funcționare continuă poate duce la avarie catastrofală.',
    problem: 'Vibrații 12 mm/s (limita 4.5 mm/s), zgomot metalic, risc avarie mecanică imediată',
    cause: 'Rulment radial pe arbore compresor uzat avansat. Joc 0.8mm față de 0.02mm toleranță. Posibil contaminare ulei cu particule metalice.',
    solution: 'Oprire imediată pentru a preveni avaria. Prelevare ulei pentru analiză particule metalice. Înlocuire rulment SKF 6308 2RS (necesită deschidere compresor). Spălare circuit ulei. Refacere aliniere. Test vibrații după reparație.',
    prevention: 'Analiză vibrații trimestrial cu analizor. Analiză ulei anual (ferrografie). Înlocuire rulmenți preventiv la 40.000 ore sau 5 ani.',
    severity: 'high', machineBrand: 'Carrier', machineModel: '30XA', machineType: 'chiller', machineYear: 2018,
    canonicalAction: 'vibration_bearing_check',
  },
  {
    title: 'Parametri în afara limitelor la pornire test — supraîncălzire insuficientă',
    description: 'După intervenție, la pornirea de test chiller-ul funcționează dar parametrii sunt în afara limitelor: superheat 2°C (minim 5°C), subcooling 12°C (maxim 8°C). Risc lichid la aspirația compresorului.',
    problem: 'Superheat 2°C (prea mic — risc lichid la compresor), subcooling 12°C (prea mare)',
    cause: 'Supapă de expansiune electronică (EEV) supra-deschisă după recalibrare. Senzor de temperatură aspirație cu offset de +3°C.',
    solution: 'Recalibrare EEV: reducere deschidere cu 15%. Verificare și înlocuire senzor NTC aspirație (rezistență la 25°C: 10kΩ±1%). Reglare până la superheat 6-8°C și subcooling 5-7°C. Monitorizare 2h înainte de predare.',
    prevention: 'Verificare parametri superheat/subcooling după orice intervenție la circuit. Calibrare senzori anual.',
    severity: 'medium', machineBrand: 'Carrier', machineModel: '30XA', machineType: 'chiller', machineYear: 2018,
    canonicalAction: 'startup_test',
  },
  {
    title: 'Motor ventilator condensator supraîncălzit — protecție termică declanșată',
    description: 'Unul din cei 4 ventilatoare de condensator nu pornește. Protecția termică s-a declanșat. Chiller funcționează cu 3 din 4 ventilatoare, temperatură condensare crescând spre limita de alarmă.',
    problem: 'Ventilator #3 condensator oprit din supraîncălzire, chiller în risc de oprire P-HIGH',
    cause: 'Bobinaj motor trifazat parțial scurt-circuitat — rezistențe de fază: L1=18Ω, L2=18Ω, L3=9Ω (asimetrie). Condensatoare de pornire defecte (măsoară 2μF față de 20μF).',
    solution: 'Oprire chiller, așteptare răcire motor (30 min). Înlocuire motor ventilator (model exact: EBM Papst 4 poli 1.5kW). Verificare și înlocuire condensatoare pornire. Test curenți de linie după montare (max dezechilibru 5%). Repornire chiller și verificare temperatură condensare.',
    prevention: 'Măsurare curenți motor la fiecare revizie. Înlocuire preventivă condensatoare electrolitice la 10 ani.',
    severity: 'high', machineBrand: 'Carrier', machineModel: '30XA', machineType: 'chiller', machineYear: 2018,
    canonicalAction: 'condenser_fan_check',
  },
  {
    title: 'Documentare incompletă — audit de securitate eșuat',
    description: 'La auditul anual de securitate al instalației, echipa de inspecție a constatat că 3 din ultimele 5 intervenții pe chiller nu au raport de intervenție complet. Lipsesc: valorile parametrilor înainte/după, cantitatea de refrigerant manipulată și semnătura tehnicianului responsabil.',
    problem: 'Rapoarte de intervenție incomplete — lipsă valori parametri, cantitate refrigerant, semnătură',
    cause: 'Formularul de raportare completat parțial la urgențe. Lipsă sistem digital de raportare — formulare hârtie pierdute sau completate incomplet sub presiunea timpului.',
    solution: 'Completare retroactivă rapoarte din memorie + loguri BMS. Implementare raportare digitală (tabletă pe teren). Checklist obligatoriu la finalizarea fiecărei intervenții: parametri înainte/după, materiale consumate, timp lucrat, semnătură.',
    prevention: 'Sistem digital de management al intervențiilor. Raportul se completează pe teren, nu la birou. Intervenția nu se consideră închisă fără raport complet.',
    severity: 'low', machineBrand: 'Carrier', machineModel: '30XA', machineType: 'chiller', machineYear: 2018,
    canonicalAction: 'documentation',
  },
];

// ─── Process flow: HVAC Emergency Diagnostic ─────────────────────────────────

const GAP = 260;
const Y   = 200;

const FLOW_NODES = [
  { id: 'demo-n1', type: 'start',    position: { x: 0,        y: Y }, data: { label: 'Start',                      description: 'Apel de urgență recepționat. Chiller central oprit.',                                                               actionId: null, conditions: '', risks: [] } },
  { id: 'demo-n2', type: 'action',   position: { x: GAP,      y: Y }, data: { label: 'LOTO & EPI',                 description: 'Aplică lockout/tagout pe separatorul principal. Echipament: mănuși criogenice, ochelari, șorț. Etichetează tabloul.',  actionId: null, conditions: '', risks: [] } },
  { id: 'demo-n3', type: 'action',   position: { x: GAP * 2,  y: Y }, data: { label: 'Citire coduri de eroare',    description: 'Conectează Carrier Service Tool la portul de diagnostic. Notează toate codurile active și istoricul ultimelor 24h.',        actionId: null, conditions: '', risks: [] } },
  { id: 'demo-n4', type: 'action',   position: { x: GAP * 3,  y: Y }, data: { label: 'Verificare presiune refrigerant', description: 'Măsoară presiunile HP și LP cu manometre calibrate. Compară cu graficul presiune-temperatură R410A.',              actionId: null, conditions: '', risks: [] } },
  { id: 'demo-n5', type: 'action',   position: { x: GAP * 4,  y: Y }, data: { label: 'Inspecție compresor & ulei',  description: 'Verifică nivel ulei în vizor, culoare, semnal separator. Ascultă zgomote anormale. Măsoară vibrații.',                  actionId: null, conditions: '', risks: [] } },
  { id: 'demo-n6', type: 'action',   position: { x: GAP * 5,  y: Y }, data: { label: 'Inspecție condensator',       description: 'Verifică starea serpentinelor și ventilatorului. Curăță dacă necesar. Măsoară curenții de linie pe fiecare motor.',    actionId: null, conditions: '', risks: [] } },
  { id: 'demo-n7', type: 'action',   position: { x: GAP * 6,  y: Y }, data: { label: 'Test electric & contactori',  description: 'Verifică tensiunile de alimentare, contactoarele principale, releele termice. Măsoară rezistența de izolație (>1MΩ).',    actionId: null, conditions: '', risks: [] } },
  { id: 'demo-n8', type: 'action',   position: { x: GAP * 7,  y: Y }, data: { label: 'Pornire test & parametri',    description: 'Repornire controlată. Verifică: superheat 6-8°C, subcooling 5-7°C, curenți, temperaturi intrare/ieșire.',                actionId: null, conditions: '', risks: [] } },
  { id: 'demo-n9', type: 'action',   position: { x: GAP * 8,  y: Y }, data: { label: 'Documentare & raportare',     description: 'Completează raportul digital: parametri înainte/după, materiale consumate, timp lucrat, refrigerant manipulat.',           actionId: null, conditions: '', risks: [] } },
  { id: 'demo-n10', type: 'end',     position: { x: GAP * 9,  y: Y }, data: { label: 'End',                         description: 'Intervenție finalizată. Chiller repornit și în parametri normali. Client notificat.',                                   actionId: null, conditions: '', risks: [] } },
];

const FLOW_EDGES = FLOW_NODES.slice(0, -1).map((n, i) => ({
  id: `demo-e${i + 1}`,
  source: n.id,
  target: FLOW_NODES[i + 1].id,
  type: 'custom',
}));

// ─── Past jobs for the Tasks page ────────────────────────────────────────────

const PAST_JOBS = [
  {
    title: 'Revizie urgență — Chiller Carrier 30XA căzut, Corp A',
    description: 'Chiller central oprit automat — alarmă P-LOW E03. Diagnosticat micro-scurgere refrigerant la supapă Schrader. Reîncărcat 1.2kg R410A, înlocuită supapă.',
    status: 'resolved',
    machineBrand: 'Carrier', machineModel: '30XA', machineType: 'chiller', machineYear: 2018,
    steps: [
      { name: 'LOTO & EPI', prompt: 'Aplicat LOTO pe separator principal. EPI complet verificat.', status: 'completed', orderIndex: 0 },
      { name: 'Citire coduri eroare', prompt: 'Cod E03 P-LOW activ. Ultimele 5 apariții în 48h.', status: 'completed', orderIndex: 1 },
      { name: 'Verificare presiune refrigerant', prompt: 'LP: 1.6 bar (min 2.1 bar). Detectată scurgere la supapă Schrader cu detector electronic.', status: 'completed', orderIndex: 2 },
      { name: 'Înlocuire supapă & reîncărcare', prompt: 'Înlocuită supapă Schrader 1/4" SAE. Vacuum 500 micron. Reîncărcat 1.2kg R410A gravimetric.', status: 'completed', orderIndex: 3 },
      { name: 'Test pornire & verificare parametri', prompt: 'LP: 4.3 bar ✓, HP: 18.2 bar ✓, superheat: 7°C ✓. Funcționare normală după 2h monitorizare.', status: 'completed', orderIndex: 4 },
      { name: 'Documentare', prompt: 'Raport complet întocmit. Refrigerant log actualizat.', status: 'completed', orderIndex: 5 },
    ],
  },
  {
    title: 'Înlocuire contactor principal pompa chiller — Corp B',
    description: 'Pompa de agent termic nu pornea la comandă. Contactor LC1D65 ars identificat la inspecție electrică. Înlocuit și testat cu succes.',
    status: 'resolved',
    machineBrand: 'Schneider', machineModel: 'LC1D65', machineType: 'tablou_electric', machineYear: 2016,
    steps: [
      { name: 'LOTO & EPI', prompt: 'Consignat tabloul electric. 3 lacăte aplicate.', status: 'completed', orderIndex: 0 },
      { name: 'Diagnosticare electrică', prompt: 'Tensiune lipsă pe ieșire contactor. Suprafețe contact carbonizate vizual.', status: 'completed', orderIndex: 1 },
      { name: 'Înlocuire contactor', prompt: 'Montat Schneider LC1D65A3. Verificate contacte auxiliare. Calibrat releu termic 42A.', status: 'completed', orderIndex: 2 },
      { name: 'Test și documentare', prompt: 'Curenți de linie L1=38A, L2=37A, L3=38A ✓. Pompa funcționează normal.', status: 'completed', orderIndex: 3 },
    ],
  },
  {
    title: 'Curățare serpentine condensator + revizie ventilatoare',
    description: 'Temperatură condensare crescută la 48°C (normal 40°C). Serpentine colmatate cu praf și depuneri organice. Curățate cu presiune joasă și degresant.',
    status: 'resolved',
    machineBrand: 'Carrier', machineModel: '30XA', machineType: 'chiller', machineYear: 2018,
    steps: [
      { name: 'Inspecție condensator', prompt: 'Depuneri organice pe ~40% din suprafața serpentinelor. Ventilator #2 cu curent asimetric (L3=8A față de L1=L2=12A).', status: 'completed', orderIndex: 0 },
      { name: 'Curățare serpentine', prompt: 'Aplicat Coil-Kleen, așteptat 15 min, clătit cu apă demineralizată la 1.5 bar dinspre interior.', status: 'completed', orderIndex: 1 },
      { name: 'Înlocuire condensatoare motor ventilator #2', prompt: 'Condensatoare 20μF înlocuite (măsurau 2.1μF și 3.4μF).', status: 'completed', orderIndex: 2 },
      { name: 'Verificare post-intervenție', prompt: 'Temperatură condensare după 1h: 41°C ✓. Curenți ventilatoare echilibrați.', status: 'completed', orderIndex: 3 },
    ],
  },
  {
    title: 'Diagnostic vibrații anormale compresor — investigație în curs',
    description: 'Vibrații 8.5 mm/s detectate la analizorul trimestrial (limita 4.5 mm/s). Prelevare probă ulei trimisă la laborator pentru analiză ferrografică. Așteptăm rezultate.',
    status: 'in_progress',
    machineBrand: 'Carrier', machineModel: '30XA', machineType: 'chiller', machineYear: 2018,
    steps: [
      { name: 'Măsurare vibrații', prompt: 'Analizor vibrații: 8.5 mm/s la 120Hz — rulment radial suspect.', status: 'completed', orderIndex: 0 },
      { name: 'Prelevare probă ulei', prompt: 'Probă 100ml prelevată și trimisă la laborator — rezultate în 5 zile lucrătoare.', status: 'completed', orderIndex: 1 },
      { name: 'Înlocuire rulment', prompt: 'Așteptăm confirmarea ferrografiei înainte de deschiderea compresorului.', status: 'in_progress', orderIndex: 2 },
      { name: 'Test final & documentare', prompt: '', status: 'pending', orderIndex: 3 },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSchemaName(databaseUrl: string): string {
  return new URL(databaseUrl).searchParams.get('schema') ?? 'public';
}

function buildEmbeddingText(inc: typeof INCIDENTS[0]): string {
  return [
    inc.title,
    inc.description,
    `Problema: ${inc.problem}`,
    `Cauza: ${inc.cause}`,
    `Soluție: ${inc.solution}`,
    `Echipament: ${inc.machineBrand} ${inc.machineModel} ${inc.machineType}`,
    inc.canonicalAction,
  ].join(' | ');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL lipsește din .env');

  const schema = getSchemaName(databaseUrl);
  const pgClient = new Client({ connectionString: databaseUrl });
  await pgClient.connect();

  try {
    await pgClient.query(`SET search_path TO "${schema}", public`);
    await pgClient.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('✅ pgvector activ (schema:', schema, ')\n');
    await run(pgClient, schema);
  } finally {
    await pgClient.end();
    await prisma.$disconnect();
  }
}

async function run(pgClient: Client, schema: string) {

  // ── 1. User ───────────────────────────────────────────────────────────────
  let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    user = await prisma.user.create({
      data: {
        email: DEMO_EMAIL, passwordHash,
        name: 'Demo Technician',
        emailVerified: true, gdprConsent: true,
        gdprConsentAt: new Date(),
      },
    });
    console.log('✅ User demo creat:', DEMO_EMAIL, '/ Demo1234!');
  } else {
    console.log('ℹ️  User demo existent:', DEMO_EMAIL);
  }

  // ── 2. Company + Team ─────────────────────────────────────────────────────
  let team = await prisma.team.findFirst({
    where: { members: { some: { userId: user.id } } },
  });
  if (!team) {
    const company = await prisma.company.create({
      data: { name: 'TechServ Installations SRL' },
    });
    team = await prisma.team.create({
      data: {
        name: 'Echipa Tehnică HVAC',
        companyId: company.id,
        members: { create: { userId: user.id, role: 'admin' } },
      },
    });
    console.log('✅ Echipă creată:', team.name, '| ID:', team.id);
  } else {
    console.log('ℹ️  Echipă existentă:', team.name, '| ID:', team.id);
  }

  // Add all existing users to this team
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
  if (added === 0) console.log('  ℹ️  Toți userii sunt deja în echipă');

  // ── 3. Process Flow ───────────────────────────────────────────────────────
  const existingFlow = await prisma.processFlow.findFirst({
    where: { title: { contains: 'Diagnostic Chiller' } },
  });
  if (!existingFlow) {
    await prisma.processFlow.create({
      data: {
        title: 'Diagnostic Chiller — Protocol Urgență HVAC',
        description: 'Protocol complet de diagnosticare a unui chiller central căzut. Acoperă siguranța (LOTO/EPI), citirea codurilor de eroare, verificarea circuitului frigorific, inspecția mecanică și electrică, testarea parametrilor și documentarea.',
        nodesJson: FLOW_NODES as any,
        edgesJson: FLOW_EDGES as any,
      },
    });
    console.log('\n✅ ProcessFlow creat: "Diagnostic Chiller — Protocol Urgență HVAC"');
  } else {
    console.log('\nℹ️  ProcessFlow deja există');
  }

  // ── 4. Past jobs + steps ──────────────────────────────────────────────────
  console.log('\n⚙️  Creare joburi demo...');
  for (const jobData of PAST_JOBS) {
    const existing = await prisma.job.findFirst({
      where: { teamId: team.id, title: jobData.title },
    });
    if (existing) {
      console.log('  ⏭️  Job există:', jobData.title.slice(0, 55));
      continue;
    }
    await prisma.job.create({
      data: {
        teamId: team.id,
        title: jobData.title,
        description: jobData.description,
        status: jobData.status,
        machineBrand: jobData.machineBrand,
        machineModel: jobData.machineModel,
        machineType: jobData.machineType,
        machineYear: jobData.machineYear,
        steps: {
          create: jobData.steps.map((s) => ({
            name: s.name,
            prompt: s.prompt,
            status: s.status,
            orderIndex: s.orderIndex,
          })),
        },
      },
    });
    console.log('  ✅ Job:', jobData.title.slice(0, 55));
  }

  // ── 5. Incidents + embeddings ─────────────────────────────────────────────
  // Need a job to link incidents to
  const baseJob = await prisma.job.findFirst({ where: { teamId: team.id } });
  if (!baseJob) throw new Error('Nu există niciun job pentru a lega incidentele');

  console.log('\n⚙️  Generez embeddings pentru incidente (OpenAI)...\n');

  for (const inc of INCIDENTS) {
    const existing = await prisma.incident.findFirst({
      where: { teamId: team.id, title: inc.title },
    });
    if (existing) {
      console.log('  ⏭️  Incident există:', inc.title.slice(0, 60));
      continue;
    }

    const embeddingText = buildEmbeddingText(inc);

    const incident = await prisma.incident.create({
      data: {
        teamId: team.id,
        jobId: baseJob.id,
        title: inc.title,
        description: inc.description,
        problem: inc.problem,
        cause: inc.cause,
        solution: inc.solution,
        prevention: inc.prevention,
        severity: inc.severity,
        machineBrand: inc.machineBrand,
        machineModel: inc.machineModel,
        machineType: inc.machineType,
        machineYear: inc.machineYear,
        canonicalAction: inc.canonicalAction,
        embeddingText,
      },
    });

    const embResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: embeddingText,
    });
    const vector = embResponse.data[0]?.embedding;
    if (!vector) throw new Error('Embedding gol de la OpenAI');

    await pgClient.query(
      `INSERT INTO "${schema}"."IncidentEmbedding"
         (id, "incidentId", "teamId", model, embedding, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4::vector, NOW(), NOW())`,
      [incident.id, team.id, EMBEDDING_MODEL, `[${vector.join(',')}]`],
    );

    console.log('  ✅', inc.title.slice(0, 65));
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🎉 Demo seed complet!\n');
  console.log('  Login:    ', DEMO_EMAIL);
  console.log('  Parola:   ', DEMO_PASSWORD);
  console.log('  Team ID:  ', team.id);
  console.log('  Flow:      "Diagnostic Chiller — Protocol Urgență HVAC"');
  console.log('  Incidente:', INCIDENTS.length, 'incidente cu embeddings');
  console.log('  Joburi:   ', PAST_JOBS.length, 'intervenții anterioare');
  console.log('\n  ➜ Deschide builder-ul, selectează flow-ul și apasă "Run Simulation"');
  console.log('    RAG va găsi incidentele relevante și soluțiile documentate!');
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((e) => { console.error('❌ Seed eșuat:', e); process.exit(1); });
