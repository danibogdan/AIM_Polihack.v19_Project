/**
 * Automotive seed — Use Cases: Reparare Motor, Reparare Frâne, Revizie Cutie Viteze
 * Creates: user, team, 18 rich incidents + embeddings, 3 process flows, 4 past jobs
 *
 * Run: npm run seed:automotive
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import OpenAI from 'openai';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

const DEMO_EMAIL    = 'auto@serviceops.dev';
const DEMO_PASSWORD = 'Auto1234!';

// ─── Use Case 1: Reparare Motor — 12 incidente (INC-01 … INC-12) ─────────────

const MOTOR_INCIDENTS = [
  {
    taskName: 'Pregătire intervenție',
    title: 'INC-01 — Scurt-circuit la deconectare baterie',
    description: 'Tehnicianul a deconectat borna pozitivă înaintea celei negative, producând scurt-circuit accidental. Scânteie vizibilă și declanșare siguranță principală.',
    problem: 'Bornele bateriei au fost deconectate în ordine greșită: pozitivă (+) înainte de negativă (-). Scurt-circuit accidental.',
    cause: 'Necunoașterea procedurii standard de deconectare a bateriei. Lipsă instruire specifică.',
    solution: 'Reconectare siguranță principală. Verificare integritate circuite electrice. Procedură corectă: se deconectează întâi borna negativă (-), apoi borna pozitivă (+).',
    prevention: 'Etichetă vizuală pe capotă cu ordinea corectă de deconectare. Checklist obligatoriu înainte de orice intervenție electrică.',
    severity: 'high',
    machineBrand: 'Volkswagen', machineModel: 'Golf 5', machineType: 'motor_benzina', machineYear: 2008,
    canonicalAction: 'engine_prep',
  },
  {
    taskName: 'Pregătire intervenție',
    title: 'INC-02 — Arsuri termice la intervenție prematură pe motor fierbinte',
    description: 'Tehnicianul a accesat compartimentul motor la 15 minute după oprire. Temperatura blocului motor era de 180°C. Arsuri superficiale de gradul I la mâini.',
    problem: 'Motor accesat la 15 min după oprire, temperatura bloc motor 180°C. Arsuri termice gradul I.',
    cause: 'Ignorarea timpului de răcire minim de 45 minute. Nu s-a verificat temperatura blocului motor înainte de atingere.',
    solution: 'Răcire forțată cu ventilator extern. Așteptare confirmare temperatura sub 60°C cu termometru IR. Prim ajutor la arsuri aplicate imediat.',
    prevention: 'Termometru IR obligatoriu înainte de orice atingere a componentelor motorului. Timp minim de așteptare 45 minute după oprire.',
    severity: 'high',
    machineBrand: 'Volkswagen', machineModel: 'Golf 5', machineType: 'motor_benzina', machineYear: 2008,
    canonicalAction: 'engine_prep',
  },
  {
    taskName: 'Deschidere motor',
    title: 'INC-03 — Furtun răcire fisurat la demontarea capacelor de protecție',
    description: 'Furtunul superior al radiatorului s-a fisurat când a fost deplasat pentru a obține acces la motor. Scurgere lichid de răcire în compartimentul motor.',
    problem: 'Furtun superior radiator fisurat la deplasare pentru acces. Scurgere lichid de răcire.',
    cause: 'Cauciuc îmbătrânit și degradat. Forță aplicată fără inspecție vizuală prealabilă a stării furtunului.',
    solution: 'Înlocuire furtun superior radiator. Golire și reumplere circuit răcire. Verificarea stării tuturor furtunurilor sistemului.',
    prevention: 'Fotografierea rutei furtunurilor înainte de orice mutare. Inspecție vizuală (fisuri, umflături, rigiditate excesivă) înainte de demontare.',
    severity: 'medium',
    machineBrand: 'Volkswagen', machineModel: 'Golf 5', machineType: 'motor_benzina', machineYear: 2008,
    canonicalAction: 'engine_inspection',
  },
  {
    taskName: 'Deschidere motor',
    title: 'INC-04 — Conector senzor MAP rupt la demontarea capacului filtru aer',
    description: 'Conectorul electric al senzorului MAP s-a rupt la desfacerea capacului filtrului de aer. Clema de prindere s-a sfărâmat, necesitând înlocuirea senzorului.',
    problem: 'Conectorul senzorului MAP rupt la desfacere capac filtru aer. Senzor necesită înlocuire.',
    cause: 'Clema de prindere fragilă din plastic îmbătrânit. Unghi greșit de tracțiune — tras în loc de apăsat-rotit.',
    solution: 'Înlocuire senzor MAP complet. Verificarea tuturor conectorilor electrice din zona de lucru.',
    prevention: 'Documentare vizuală (foto) a tuturor conectorilor electrici înainte de acces. Tehnica apăsare-rotire pentru cuplele electrice cu clemă.',
    severity: 'medium',
    machineBrand: 'Volkswagen', machineModel: 'Golf 5', machineType: 'motor_benzina', machineYear: 2008,
    canonicalAction: 'engine_inspection',
  },
  {
    taskName: 'Demontare motor parțial',
    title: 'INC-05 — Chiulasă fisurată la demontare în ordine greșită',
    description: 'Chiulasa a suferit o fisură după desfacerea șuruburilor în ordine centrifugă în loc de cruce. Tensiunile interne s-au eliberat neuniform, fisurând chiulasa.',
    problem: 'Fisură pe chiulasă după scoaterea șuruburilor în ordine greșită (centrifugă în loc de cruce, interior spre exterior).',
    cause: 'Nerespectarea ordinii de demontare. Tensiunile interne eliberate neuniform au fisurat chiulasa.',
    solution: 'Înlocuire chiulasă. Instruire tehnician privind ordinea corectă de demontare în cruce, din interior spre exterior.',
    prevention: 'Schemă laminată cu ordinea numerotată de demontare lipită la bancul de lucru. Verificare obligatorie a schemei înainte de demontare.',
    severity: 'high',
    machineBrand: 'Volkswagen', machineModel: 'Golf 5', machineType: 'motor_benzina', machineYear: 2008,
    canonicalAction: 'engine_disassembly',
  },
  {
    taskName: 'Demontare motor parțial',
    title: 'INC-06 — Garnitură de supapă pierdută la reasamblare — scurgeri ulei',
    description: 'Motorul a fost asamblat fără garnitura de supapă care căzuse neobservată. La pornire au apărut scurgeri vizibile de ulei, necesitând demontare parțială pentru remediere.',
    problem: 'Motor asamblat fără garnitura de supapă (a căzut și nu a fost observată). Scurgeri ulei la prima pornire.',
    cause: 'Lipsa unui sistem de organizare a pieselor demontate. Garnitura mică a căzut și nu a fost identificată la reasamblare.',
    solution: 'Demontare parțială. Repoziționare garnitură nouă. Implementare sistem cutii numerotate pentru piesele demontate.',
    prevention: 'Fotografiere piese demontate înainte de dezasamblare. Checklist piesă cu piesă. Cutii numerotate pentru organizare componente.',
    severity: 'medium',
    machineBrand: 'Volkswagen', machineModel: 'Golf 5', machineType: 'motor_benzina', machineYear: 2008,
    canonicalAction: 'engine_disassembly',
  },
  {
    taskName: 'Verificare pistoane',
    title: 'INC-07 — Fisură fină pe piston nedetectată — retur în service după 2 săptămâni',
    description: 'Clientul a revenit după 2 săptămâni cu pierdere de putere. O fisură circulară superficială pe piston nu fusese observată la inspecția inițială, ducând la avarie progresivă.',
    problem: 'Fisură circulară superficială pe piston nedetectată la inspecția inițială. Client revenit cu pierdere de putere după 2 săptămâni.',
    cause: 'Inspecție vizuală efectuată fără lumină laterală adecvată și fără lupă. Fisura era superficială și necesita iluminare specifică pentru detecție.',
    solution: 'Înlocuire piston afectat. Implementare protocol de inspecție cu lanternă LED + lupă 5x obligatorie. Re-inspecție toate pistoanele.',
    prevention: 'Inspecție sub 3 unghiuri de iluminare diferite pentru fiecare piston. Lanternă LED de putere mare + lupă 5x — obligatorii în trusa de verificare.',
    severity: 'high',
    machineBrand: 'Volkswagen', machineModel: 'Golf 5', machineType: 'motor_benzina', machineYear: 2008,
    canonicalAction: 'piston_check',
  },
  {
    taskName: 'Verificare pistoane',
    title: 'INC-08 — Depuneri masive carbon pe pistoane — gripare piston la pornire test',
    description: 'Pistonul s-a gripit în cilindru la prima pornire de test. Depuneri de carbon de 4mm grosime fuseseră considerate normale și nu fuseseră eliminate înainte de reasamblare.',
    problem: 'Piston gripit în cilindru la pornire test. Depuneri carbon 4mm grosime ignorate la inspecție — considerate normale.',
    cause: 'Lipsa criteriilor clare pentru nivelul acceptabil de depuneri carbon. Ulei nedegajat + funcționare 3 ani exclusiv trasee scurte urbane.',
    solution: 'Decarbonizare chimică completă. Înlocuire segmenți piston. Curățare mecanică piston. Refacere reasamblare.',
    prevention: 'Standard vizual de comparație pentru depuneri carbon (grosime maximă admisă: 1mm). Recomandare client: schimb ulei la 10.000 km + revizie periodică.',
    severity: 'high',
    machineBrand: 'Volkswagen', machineModel: 'Golf 5', machineType: 'motor_benzina', machineYear: 2008,
    canonicalAction: 'piston_check',
  },
  {
    taskName: 'Verificare cilindri',
    title: 'INC-09 — Zgârieturi adânci cilindru 3 — gripaj segmenți, pierdere compresie 40%',
    description: 'Cilindrul 3 prezenta zgărieturi longitudinale adânci de 0.3mm nedetectate la inspecție vizuală. La pornire, segmenții au gripit pe zgărieturi, rezultând pierdere de compresie de 40%.',
    problem: 'Cilindrul 3 cu zgărieturi longitudinale adânci 0.3mm. Pierdere compresie 40% după reasamblare. Gripaj segmenți.',
    cause: 'Funcționare anterioară fără ulei suficient — senzor nivel ulei defect. Inspecție efectuată fără iluminare laterală sau instrumente de măsurare.',
    solution: 'Alezare cilindru 3. Segmenți noi piston oversize. Înlocuire senzor nivel ulei. Verificare compresie pe toți cilindrii.',
    prevention: 'Utilizare procedură standard de verificare cilindri cu bore gauge. Verificare nivel ulei la fiecare schimb. Calibrare anuală senzor nivel ulei.',
    severity: 'high',
    machineBrand: 'Volkswagen', machineModel: 'Golf 5', machineType: 'motor_benzina', machineYear: 2008,
    canonicalAction: 'cylinder_check',
  },
  {
    taskName: 'Verificare cilindri',
    title: 'INC-10 — Uzură conică nedetectată pe toți cilindrii — motor pornit frecvent la rece',
    description: 'Uzură conică de 0.15mm (diametru diferit sus/jos) detectată la toți cilindrii după reasamblare. Motorul fusese pornit frecvent la -10°C fără preîncălzire. Segmenții nu au etanșat corespunzător.',
    problem: 'Uzură conică pe toți cilindrii (0.15mm diferență diametru sus/jos) nedetectată la verificare vizuală. Consum ulei crescut, compresie scăzută.',
    cause: 'Porniri frecvente la temperaturi sub -10°C fără preîncălzire. Uleiul vâscos nu ajungea la timp în cilindri. Inspecție doar vizuală, fără instrumente de măsurare.',
    solution: 'Rectificare cilindri cu honuire. Segmenți oversize. Schimb ulei la 5W-40 sintetic adaptat temperaturilor scăzute.',
    prevention: 'Măsurare diametru cilindri obligatorie în minim 3 puncte (sus, mijloc, jos) cu bore gauge. Recomandare client: preîncălzire motor 3 minute la temperaturi sub 0°C.',
    severity: 'medium',
    machineBrand: 'Volkswagen', machineModel: 'Golf 5', machineType: 'motor_benzina', machineYear: 2008,
    canonicalAction: 'cylinder_check',
  },
  {
    taskName: 'Verificare ulei',
    title: 'INC-11 — Ulei contaminat cu antigel — garnitură chiulasă arsă',
    description: 'Uleiul motor prezenta aspect lăptos alb-gri, indicând amestec cu lichid de răcire. Garnitura de chiulasă era arsă între cilindrul 2 și canalul de răcire.',
    problem: 'Ulei cu aspect lăptos alb-gri — amestec cu lichid de răcire (antigel). Pierdere presiune ulei progresivă.',
    cause: 'Garnitura de chiulasă arsă între cilindrul 2 și canalul de răcire. Supraîncălzire anterioară nedetectată care a deteriorat garnitura.',
    solution: 'Înlocuire garnitură chiulasă. Spălare circuit ulei (flush complet). Schimb total ulei + filtru. Verificare planeitate chiulasă înainte de remontare.',
    prevention: 'Test de compresie + test etanșeitate chiulasă înainte de fiecare revizie completă. Verificare culoare ulei la fiecare schimb.',
    severity: 'high',
    machineBrand: 'Volkswagen', machineModel: 'Golf 5', machineType: 'motor_benzina', machineYear: 2008,
    canonicalAction: 'oil_check_replace',
  },
  {
    taskName: 'Verificare ulei',
    title: 'INC-12 — Particule metalice în ulei — rulment bielă cilindru 1 în avarie',
    description: 'Verificarea magnetică a uleiului a relevat particule argintii fine — semn de uzură avansată rulment bielă la cilindrul 1. Motorul funcționase 500km cu nivel ulei sub limita minimă.',
    problem: 'Particule argintii metalice în ulei la verificare magnetică. Rulment bielă cilindru 1 în stadiu de avarie.',
    cause: 'Funcționare 500km cu nivel ulei minim sub limita de avertizare. Senzor presiune ulei ignorat de operator.',
    solution: 'Înlocuire urgentă rulment bielă cilindru 1. Schimb filtre ulei. Flush complet sistem lubrifiere. Verificare bielă pentru deformări.',
    prevention: 'Oprire imediată dacă martorul presiune ulei se aprinde. Verificare nivel ulei la fiecare alimentare cu combustibil. Revizie la 10.000 km sau 1 an.',
    severity: 'high',
    machineBrand: 'Volkswagen', machineModel: 'Golf 5', machineType: 'motor_benzina', machineYear: 2008,
    canonicalAction: 'oil_check_replace',
  },
];

// ─── Use Case 2: Reparare Sistem de Frânare — 4 incidente ─────────────────────

const FRANE_INCIDENTS = [
  {
    taskName: 'Reasamblare motor',
    title: 'INC-13 — Garnitură capac motor montată incorect — scurgeri ulei după pornire',
    description: 'După pornire au apărut scurgeri de ulei din zona capacului motor. Garnitura fusese montată greșit — ciupită pe o porțiune — și nu asigura etanșeitate corespunzătoare.',
    problem: 'Scurgeri ulei din zona capacului motor imediat după prima pornire post-intervenție.',
    cause: 'Garnitura montată greșit sau ciupită la reasamblare. Nu s-a verificat poziționarea corectă înainte de strângerea finală.',
    solution: 'Demontare locală capac motor. Curățare locaș garnitură. Montare garnitură nouă în poziție corectă. Strângere conform specificațiilor.',
    prevention: 'Verificare vizuală poziție garnitură pe tot perimetrul înainte de strângerea finală. Rotație ușoară garnitură după montare inițială pentru centrare.',
    severity: 'medium',
    machineBrand: 'Dacia', machineModel: 'Duster', machineType: 'sistem_franare', machineYear: 2018,
    canonicalAction: 'engine_reassembly',
  },
  {
    taskName: 'Verificare finală și documentare',
    title: 'INC-14 — Cuplu de strângere greșit la roți — roată aproape desprinsă în probe de drum',
    description: 'La proba de drum obligatorie, una din roți a prezentat joc anormal. Piulițele fuseseră strânse la un cuplu incorect (60 Nm în loc de 110 Nm). Proba de drum a interceptat problema la timp.',
    problem: 'Piulițe roată strânse la 60 Nm în loc de 110 Nm specificat. Joc detectat la proba de drum. Risc de desprindere roată.',
    cause: 'Nu s-a folosit cheie dinamometrică. Strângere estimativă fără verificare instrumentată.',
    solution: 'Refacerea strângerii tuturor roților la 110-120 Nm cu cheie dinamometrică calibrată. Re-probă de drum extinsă.',
    prevention: 'Cheie dinamometrică obligatorie la montarea roților. Verificare cuplu strângere la toate cele 4 roți la fiecare intervenție ce implică demontarea roților.',
    severity: 'high',
    machineBrand: 'Dacia', machineModel: 'Duster', machineType: 'sistem_franare', machineYear: 2018,
    canonicalAction: 'documentation',
  },
  {
    taskName: 'Verificare disc și tambur de frână',
    title: 'INC-15 — Disc frână sub grosimea minimă montă pe ax — vibrații pedală',
    description: 'Un disc de frână cu grosimea de 8mm (limita minimă 10mm) a fost reutilizat pentru economie de costuri. Clientul a revenit cu vibrații puternice în pedală și decelerare inegală.',
    problem: 'Disc frână spate dreapta grosime 8mm (sub limita 10mm). Vibrații pedală frână și tragere laterală la frânare.',
    cause: 'Decizie de reutilizare disc uzat sub limita minimă admisă de producător. Lipsă verificare cu micrometrul.',
    solution: 'Înlocuire ambele discuri pe ax (ax complet — niciodată un singur disc). Test frânare cuplu comparativ stânga-dreapta.',
    prevention: 'Măsurare obligatorie grosime disc cu micrometrul în 4 puncte. Comparare cu limita minimă înscrisă pe disc. Înlocuire pe ax complet — niciodată unilateral.',
    severity: 'high',
    machineBrand: 'Dacia', machineModel: 'Duster', machineType: 'sistem_franare', machineYear: 2018,
    canonicalAction: 'disc_check',
  },
  {
    taskName: 'Purjare și verificare circuit hidraulic',
    title: 'INC-16 — Bulă de aer rămasă în circuit hidraulic frâne — pedală moale',
    description: 'La predarea mașinii, clientul a reclamat pedala de frână moale și cursă lungă. Purjarea fusese efectuată în ordine greșită (de la pompă spre exterior în loc de roata cea mai depărtată prima).',
    problem: 'Pedală frână moale cu cursă lungă după purjare. Bulă de aer rămasă în circuitul hidraulic.',
    cause: 'Purjarea circuitului efectuată în ordine greșită. Nu s-a urmărit lichidul de ieșire până la eliminarea completă a bulelor.',
    solution: 'Repurjare completă în ordine corectă: spate dreapta → spate stânga → față dreapta → față stânga. Verificare fermitate pedală după fiecare roată.',
    prevention: 'Afișare ordine corectă de purjare la bancul de lucru. Verificare fermitate pedală obligatorie la final — minim 10 apăsări complete înainte de predare.',
    severity: 'medium',
    machineBrand: 'Dacia', machineModel: 'Duster', machineType: 'sistem_franare', machineYear: 2018,
    canonicalAction: 'hydraulic_check',
  },
];

// ─── Use Case 3: Revizie Cutie de Viteze Manuală — 2 incidente ────────────────

const CUTIE_INCIDENTS = [
  {
    taskName: 'Verificare ulei cutie de viteze',
    title: 'INC-17 — Ulei cutie viteze negru cu particule metalice — angrenaje uzate avansat',
    description: 'Uleiul drenat din cutia de viteze era negru-intens cu particule metalice vizibile la examinare magnetică. Magnecul dopului de golire era acoperit cu depuneri fine argintii.',
    problem: 'Ulei cutie viteze negru cu particule metalice — uzură avansată internă. Angrenaje probabil deteriorate.',
    cause: 'Intervalul de schimb ulei cutie depășit semnificativ (last change necunoscută). Uleiul degradat nu a mai lubrifiat corespunzător angrenajele.',
    solution: 'Demontare cutie pentru inspecție internă. Identificare și înlocuire angrenaje uzate. Spălare cutie cu ulei mineral. Reumplere cu ulei sintetic GL-4 75W-90.',
    prevention: 'Schimb ulei cutie viteze la 60.000 km sau 4 ani. Verificare nivel și culoare ulei la fiecare revizie anuală. Notare kilometraj la fiecare schimb în fișa de service.',
    severity: 'high',
    machineBrand: 'Renault', machineModel: 'Megane II', machineType: 'cutie_viteze_manuala', machineYear: 2015,
    canonicalAction: 'oil_check_replace',
  },
  {
    taskName: 'Inspecție ambreiaj și volant motor',
    title: 'INC-18 — Disc ambreiaj cu pete de ulei — patinaj persistent după înlocuire',
    description: 'Ambreiajul nou instalat patina la tras în pantă. Inspecția a relevat că discul fusese contaminat cu ulei de la o garnitură de ulei motor defectă neidentificată anterior.',
    problem: 'Ambreiaj nou patinat persistent. Disc de fricțiune contaminat cu ulei prin garnitură motor defectă.',
    cause: 'Garnitura de ulei a arborelui cotit defectă neinspectată înainte de montaj. Uleiul a contaminat discul de ambreiaj nou în primele ore de funcționare.',
    solution: 'Demontare ambreiaj. Înlocuire garnitură arbore cotit. Înlocuire disc ambreiaj (al doilea kit). Curățare suprafețe contact volant și placă de presiune.',
    prevention: 'Inspecție obligatorie garnitură arbore cotit (simering) înainte de montarea kitului de ambreiaj. Cost mic = evitarea unui al doilea kit de ambreiaj.',
    severity: 'high',
    machineBrand: 'Renault', machineModel: 'Megane II', machineType: 'cutie_viteze_manuala', machineYear: 2015,
    canonicalAction: 'clutch_inspection',
  },
];

const ALL_INCIDENTS = [...MOTOR_INCIDENTS, ...FRANE_INCIDENTS, ...CUTIE_INCIDENTS];

// ─── Process Flow: Reparare Motor ────────────────────────────────────────────

const GAP = 260;
const Y   = 200;

const MOTOR_NODES = [
  { id: 'm-n1', type: 'start',  position: { x: 0,        y: Y }, data: { label: 'Start',                        description: 'Recepție vehicul. Documentare simptome raportate de client și kilometraj.',                                               actionId: null, conditions: '', risks: [] } },
  { id: 'm-n2', type: 'action', position: { x: GAP,      y: Y }, data: { label: 'Pregătire intervenție',        description: 'Oprire motor, răcire min 45 min, verificare IR temp < 60°C, deconectare baterie (-) prima, organizare scule și spațiu.',    actionId: null, conditions: '', risks: [] } },
  { id: 'm-n3', type: 'action', position: { x: GAP * 2,  y: Y }, data: { label: 'Deschidere motor',            description: 'Fotografiere compartiment motor. Demontare capace și protecții. Inspecție vizuală furtunuri și conectori înainte de atingere.', actionId: null, conditions: '', risks: [] } },
  { id: 'm-n4', type: 'action', position: { x: GAP * 3,  y: Y }, data: { label: 'Demontare motor parțial',     description: 'Demontare chiulasă în ordine cruce interior→exterior. Organizare piese în cutii numerotate cu fotografii.',                   actionId: null, conditions: '', risks: [] } },
  { id: 'm-n5', type: 'action', position: { x: GAP * 4,  y: Y }, data: { label: 'Verificare pistoane',         description: 'Inspecție piston cu lanternă LED + lupă 5x sub 3 unghiuri. Verificare fisuri, uzură, depuneri carbon (max 1mm acceptat).',  actionId: null, conditions: '', risks: [] } },
  { id: 'm-n6', type: 'action', position: { x: GAP * 5,  y: Y }, data: { label: 'Verificare cilindri',         description: 'Măsurare diametru cilindri cu bore gauge în 3 puncte (sus/mijloc/jos). Detectare uzură conică, zgârieturi, ovalizare.',       actionId: null, conditions: '', risks: [] } },
  { id: 'm-n7', type: 'action', position: { x: GAP * 6,  y: Y }, data: { label: 'Verificare ulei',             description: 'Analiză magnetică ulei (particule metalice), culoare (lăptos = antigel), nivel și consistență. Decizie flush sau investigație.', actionId: null, conditions: '', risks: [] } },
  { id: 'm-n8', type: 'action', position: { x: GAP * 7,  y: Y }, data: { label: 'Reasamblare motor',           description: 'Reasamblare inversă demontării. Verificare garnituri. Strângere șuruburi chiulasă cu cheie dinamometrică conform specificații.', actionId: null, conditions: '', risks: [] } },
  { id: 'm-n9', type: 'end',    position: { x: GAP * 8,  y: Y }, data: { label: 'End',                         description: 'Pornire test. Verificare parametri. Probă de drum. Documentare completă și predare vehicul.',                               actionId: null, conditions: '', risks: [] } },
];

const MOTOR_EDGES = MOTOR_NODES.slice(0, -1).map((n, i) => ({
  id: `m-e${i + 1}`,
  source: n.id,
  target: MOTOR_NODES[i + 1].id,
  type: 'custom',
}));

// ─── Process Flow: Reparare Sistem de Frânare ────────────────────────────────

const FRANE_NODES = [
  { id: 'f-n1', type: 'start',  position: { x: 0,        y: Y }, data: { label: 'Start',                              description: 'Recepție vehicul. Documentare simptome frânare: zgomote, vibrații, tragere laterală, cursă pedală.',                  actionId: null, conditions: '', risks: [] } },
  { id: 'f-n2', type: 'action', position: { x: GAP,      y: Y }, data: { label: 'Inspecție inițială frâne',           description: 'Ridicare vehicul pe elevator. Demontare roți. Inspecție vizuală plăcuțe, discuri, calibre, furtunuri frână.',        actionId: null, conditions: '', risks: [] } },
  { id: 'f-n3', type: 'action', position: { x: GAP * 2,  y: Y }, data: { label: 'Verificare disc și tambur',          description: 'Măsurare grosime disc cu micrometrul în 4 puncte. Verificare voalaj (max 0.08mm), fisuri, pete supraîncălzire.',       actionId: null, conditions: '', risks: [] } },
  { id: 'f-n4', type: 'action', position: { x: GAP * 3,  y: Y }, data: { label: 'Verificare calibru și cilindri',     description: 'Inspecție scurgeri, coroziune pistonașe, libertate mișcare. Verificare flexibile frână pentru fisuri și umflături.',   actionId: null, conditions: '', risks: [] } },
  { id: 'f-n5', type: 'action', position: { x: GAP * 4,  y: Y }, data: { label: 'Înlocuire plăcuțe și discuri',       description: 'Înlocuire pe ax complet — niciodată unilateral. Pastă anti-scârțâit spate plăcuțe. Lubrifiere ghidaje calibru.',       actionId: null, conditions: '', risks: [] } },
  { id: 'f-n6', type: 'action', position: { x: GAP * 5,  y: Y }, data: { label: 'Purjare circuit hidraulic',          description: 'Verificare culoare lichid frână. Purjare în ordine: spate dreapta → spate stânga → față dreapta → față stânga.',       actionId: null, conditions: '', risks: [] } },
  { id: 'f-n7', type: 'action', position: { x: GAP * 6,  y: Y }, data: { label: 'Rodaj plăcuțe și test frânare',      description: '10 frânări progresive 50→10 km/h cu răcire între fiecare. Verificare frânare dreaptă, fără zgomote sau vibrații pedală.', actionId: null, conditions: '', risks: [] } },
  { id: 'f-n8', type: 'action', position: { x: GAP * 7,  y: Y }, data: { label: 'Verificare finală și documentare',   description: 'Strângere roți la 110-120 Nm cu cheie dinamometrică. Probă de drum 5 km. Documentare completă intervenție.',             actionId: null, conditions: '', risks: [] } },
  { id: 'f-n9', type: 'end',    position: { x: GAP * 8,  y: Y }, data: { label: 'End',                                description: 'Sistem de frânare verificat și funcțional. Client informat despre comportamentul normal al plăcuțelor noi (rodaj).',   actionId: null, conditions: '', risks: [] } },
];

const FRANE_EDGES = FRANE_NODES.slice(0, -1).map((n, i) => ({
  id: `f-e${i + 1}`,
  source: n.id,
  target: FRANE_NODES[i + 1].id,
  type: 'custom',
}));

// ─── Process Flow: Revizie Cutie de Viteze Manuală ───────────────────────────

const CUTIE_NODES = [
  { id: 'c-n1', type: 'start',  position: { x: 0,        y: Y }, data: { label: 'Start',                             description: 'Recepție vehicul. Documentare simptome: treapte greu de cuplat, zgomote, scurgeri ulei, pedală ambreiaj anormală.',  actionId: null, conditions: '', risks: [] } },
  { id: 'c-n2', type: 'action', position: { x: GAP,      y: Y }, data: { label: 'Diagnosticare simptome',            description: 'Probă de drum scurtă pentru reproducerea simptomelor. Conectare scanner dacă vehiculul are senzori transmisie.',        actionId: null, conditions: '', risks: [] } },
  { id: 'c-n3', type: 'action', position: { x: GAP * 2,  y: Y }, data: { label: 'Verificare ulei cutie viteze',      description: 'Verificare nivel ulei prin dopul de nivel. Analiză culoare și particule metalice (magnet dop golire). Drenare completă.', actionId: null, conditions: '', risks: [] } },
  { id: 'c-n4', type: 'action', position: { x: GAP * 3,  y: Y }, data: { label: 'Demontare cutie de viteze',         description: 'Demontare arbore transmisie, cabluri schimbare, suporturi. Susținere cutie cu cric transmisie. Marcare poziție față de motor.',  actionId: null, conditions: '', risks: [] } },
  { id: 'c-n5', type: 'action', position: { x: GAP * 4,  y: Y }, data: { label: 'Inspecție ambreiaj și volant',      description: 'Verificare grosime disc ambreiaj (min 3mm). Inspecție pete ulei, fisuri. Verificare volant și placă presiune. Inspecție simering arbore cotit.', actionId: null, conditions: '', risks: [] } },
  { id: 'c-n6', type: 'action', position: { x: GAP * 5,  y: Y }, data: { label: 'Reparare și reasamblare',           description: 'Înlocuire componente uzate. Reasamblare cutie. Reumplere ulei sintetic GL-4 75W-90. Verificare etanșeitate după montaj.',  actionId: null, conditions: '', risks: [] } },
  { id: 'c-n7', type: 'end',    position: { x: GAP * 6,  y: Y }, data: { label: 'End',                               description: 'Verificare funcționare toate treptele. Probă de drum. Documentare completă și predare vehicul.',                        actionId: null, conditions: '', risks: [] } },
];

const CUTIE_EDGES = CUTIE_NODES.slice(0, -1).map((n, i) => ({
  id: `c-e${i + 1}`,
  source: n.id,
  target: CUTIE_NODES[i + 1].id,
  type: 'custom',
}));

// ─── Past Jobs ───────────────────────────────────────────────────────────────

const PAST_JOBS = [
  {
    title: 'Reparare motor complet — VW Golf 5 1.9 TDI, 148.000 km',
    description: 'Motor demontat pentru înlocuire pistoane și segmenți. Detectate depuneri masive carbon și uzură conică cilindri. Rectificare cilindri, decarbonizare, segmenți oversize. Garnitură chiulasă înlocuită.',
    status: 'resolved',
    machineBrand: 'Volkswagen', machineModel: 'Golf 5', machineType: 'motor_benzina', machineYear: 2008,
    steps: [
      { name: 'Pregătire intervenție', prompt: 'Motor răcit 45 min. Temp. verificată IR: 52°C. Baterie deconectată (-) prima. Spațiu de lucru organizat.', status: 'completed', orderIndex: 0 },
      { name: 'Deschidere motor', prompt: 'Capace fotografiate. Furtunuri inspectate — furtun superior radiator cu fisuri fine, înlocuit preventiv. Conectori documentați.', status: 'completed', orderIndex: 1 },
      { name: 'Demontare motor parțial', prompt: 'Chiulasă demontată în ordine cruce. Piese organizate în 6 cutii numerotate cu etichete și fotografii.', status: 'completed', orderIndex: 2 },
      { name: 'Verificare pistoane', prompt: 'Piston 2 cu fisură fină detectată la lupă 5x, iluminare laterală. Toate pistoanele cu depuneri carbon 3-4mm — decarbonizare chimică.', status: 'completed', orderIndex: 3 },
      { name: 'Verificare cilindri', prompt: 'Bore gauge: uzură conică 0.12-0.18mm la toți cilindrii. Rectificare + honuire. Segmenți oversize +0.50mm.', status: 'completed', orderIndex: 4 },
      { name: 'Verificare ulei', prompt: 'Ulei cu aspect ușor lăptos — test confirmat contaminare cu antigel. Garnitură chiulasă arsă cilindrul 2. Flush complet sistem ulei.', status: 'completed', orderIndex: 5 },
      { name: 'Reasamblare motor', prompt: 'Garnituri noi verificate poziție înainte de strângere. Chiulasă strânsă la 25 Nm + 90° conform specificații VW. Verificat fiecare garnitură înainte de închidere.', status: 'completed', orderIndex: 6 },
      { name: 'Pornire test și documentare', prompt: 'Pornire primă OK. Presiune ulei normală. Nicio scurgere detectată în 30 min. Compresie: 14-15 bar uniform pe toți cilindrii. Raport complet întocmit.', status: 'completed', orderIndex: 7 },
    ],
  },
  {
    title: 'Revizie sistem frânare complet — Dacia Duster 1.5 dCi, 85.000 km',
    description: 'Înlocuire plăcuțe și discuri față și spate. Purjare circuit hidraulic complet. Disc spate dreapta sub limita minimă detectat la măsurare — înlocuit ax complet.',
    status: 'resolved',
    machineBrand: 'Dacia', machineModel: 'Duster', machineType: 'sistem_franare', machineYear: 2018,
    steps: [
      { name: 'Inspecție inițială frâne', prompt: 'Plăcuțe față: 3mm (limita 4mm). Discuri față: 23mm (limita 22mm) ✓. Disc spate dreapta: 8mm (limita 10mm) — înlocuire obligatorie ax spate complet.', status: 'completed', orderIndex: 0 },
      { name: 'Verificare disc și tambur', prompt: 'Micrometru: disc față stânga 23.2mm, față dreapta 23.0mm ✓. Disc spate dreapta 8.1mm ❌ — sub limita minimă 10mm.', status: 'completed', orderIndex: 1 },
      { name: 'Verificare calibru și cilindri', prompt: 'Calibru față stânga: piston blocat parțial — forță 180N la retragere (normal <50N). Calibru înlocuit. Flexibile fără fisuri.', status: 'completed', orderIndex: 2 },
      { name: 'Înlocuire plăcuțe și discuri', prompt: 'Înlocuire kit față + kit spate. Pastă anti-scârțâit aplicată. Ghidaje calibru lubrifiate. Arcuri și cleme noi pe toți calibrii.', status: 'completed', orderIndex: 3 },
      { name: 'Purjare circuit hidraulic', prompt: 'Lichid frână DOT 4 înlocuit complet. Purjare în ordine corectă: SD→SS→FD→FS. Lichid ieșit clar fără bule după 200ml per roată.', status: 'completed', orderIndex: 4 },
      { name: 'Rodaj plăcuțe și test frânare', prompt: '10 frânări 50→10 km/h cu răcire 2 min între fiecare. Frânare dreaptă, fără vibrații sau zgomote. Pedală fermă la prima apăsare.', status: 'completed', orderIndex: 5 },
      { name: 'Verificare finală și documentare', prompt: 'Roți strânse la 110 Nm cu cheie dinamometrică calibrată. Probă de drum 8 km inclusiv frânări urgență simulate. Raport emis.', status: 'completed', orderIndex: 6 },
    ],
  },
  {
    title: 'Revizie cutie viteze manuală — Renault Megane II 1.6 16V, 132.000 km',
    description: 'Scrâșnituri la cuplarea treptei 2 și 3. Ulei cutie negru cu particule metalice. Disc ambreiaj uzat 2mm. Sincron tr.2 deteriorat. Ambreiaj complet înlocuit.',
    status: 'resolved',
    machineBrand: 'Renault', machineModel: 'Megane II', machineType: 'cutie_viteze_manuala', machineYear: 2015,
    steps: [
      { name: 'Diagnosticare simptome', prompt: 'Probă de drum: scrâșnituri clare la cuplarea tr.2 și tr.3 la rece. Pedală ambreiaj cu punct de decuplare jos. Scanner: fără coduri active.', status: 'completed', orderIndex: 0 },
      { name: 'Verificare ulei cutie viteze', prompt: 'Ulei drenat: negru intens, miros ars. Magnet dop: depuneri metalice consistente — uzură internă confirmată. Cantitate: 1.8L (normal 2.1L) — nivel scăzut.', status: 'completed', orderIndex: 1 },
      { name: 'Demontare cutie de viteze', prompt: 'Arbore transmisie demontat. Cabluri schimbare fotografie + marcare. Cutie susținută cu cric transmisie. Marcată poziția față de motor.', status: 'completed', orderIndex: 2 },
      { name: 'Inspecție ambreiaj și volant', prompt: 'Disc ambreiaj: 2.1mm (min 3mm) ❌. Pete ulei pe disc — simering arbore cotit defect ❌. Simering înlocuit înainte de kit ambreiaj. Volant rectificat.', status: 'completed', orderIndex: 3 },
      { name: 'Reparare și reasamblare', prompt: 'Sincron tr.2 și tr.3 înlocuite. Kit ambreiaj nou montaj după înlocuire simering. Reumplere ulei GL-4 75W-90 sintetic 2.1L. Test etanșeitate 24h.', status: 'completed', orderIndex: 4 },
    ],
  },
  {
    title: 'Diagnostic vibrații la frânare — Ford Focus 2017, investigație în curs',
    description: 'Client reclamă vibrații puternice în volan la frânare de la 80 km/h. Suspectate discuri față cu voalaj termic. Așteptăm confirmare măsurători cu comparatorul.',
    status: 'in_progress',
    machineBrand: 'Ford', machineModel: 'Focus', machineType: 'sistem_franare', machineYear: 2017,
    steps: [
      { name: 'Inspecție inițială', prompt: 'Vibrații reproduced la test drive 80→20 km/h. Discuri față vizual ok, fără fisuri. Plăcuțe 6mm — ok.', status: 'completed', orderIndex: 0 },
      { name: 'Măsurare voalaj discuri', prompt: 'Față stânga: voalaj 0.09mm (max 0.08mm) ❌. Față dreapta: 0.06mm ✓. Confirmat disc față stânga cu voalaj peste limită.', status: 'completed', orderIndex: 1 },
      { name: 'Înlocuire discuri față', prompt: 'Înlocuire disc față stânga. Înlocuire disc față dreapta pe același ax (obligatoriu ax complet). Așteptăm autorizare client pentru buget.', status: 'in_progress', orderIndex: 2 },
      { name: 'Test final și documentare', prompt: '', status: 'pending', orderIndex: 3 },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSchemaName(databaseUrl: string): string {
  return new URL(databaseUrl).searchParams.get('schema') ?? 'public';
}

function buildEmbeddingText(inc: typeof ALL_INCIDENTS[0]): string {
  return [
    inc.title,
    inc.taskName,
    inc.description,
    `Problema: ${inc.problem}`,
    `Cauza: ${inc.cause}`,
    `Soluție: ${inc.solution}`,
    `Prevenire: ${inc.prevention}`,
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
        name: 'Auto Technician',
        emailVerified: true, gdprConsent: true,
        gdprConsentAt: new Date(),
      },
    });
    console.log('✅ User creat:', DEMO_EMAIL, '/', DEMO_PASSWORD);
  } else {
    console.log('ℹ️  User existent:', DEMO_EMAIL);
  }

  // ── 2. Company + Team ─────────────────────────────────────────────────────
  let team = await prisma.team.findFirst({
    where: { name: 'Echipa Mecanici Auto' },
  });
  if (!team) {
    const company = await prisma.company.create({
      data: { name: 'Auto Reparatii Pro SRL' },
    });
    team = await prisma.team.create({
      data: {
        name: 'Echipa Mecanici Auto',
        companyId: company.id,
        members: { create: { userId: user.id, role: 'admin' } },
      },
    });
    console.log('✅ Echipă creată:', team.name, '| ID:', team.id);
  } else {
    console.log('ℹ️  Echipă existentă:', team.name, '| ID:', team.id);
  }

  // Adaugă toți userii existenți la această echipă
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

  // ── 3. Process Flows ──────────────────────────────────────────────────────
  const flows = [
    {
      title: 'UC1 — Reparare Motor',
      description: 'Protocol complet reparare motor: pregătire (răcire, deconectare baterie), deschidere compartiment, demontare parțială chiulasă, inspecție pistoane și cilindri, verificare ulei, reasamblare și test. Acoperă cele 12 incidente documentate (INC-01 la INC-12).',
      nodesJson: MOTOR_NODES as any,
      edgesJson: MOTOR_EDGES as any,
    },
    {
      title: 'UC2 — Reparare Sistem de Frânare',
      description: 'Protocol complet revizie sistem frânare: inspecție plăcuțe/discuri/calibre, măsurare grosime disc cu micrometru, verificare circuit hidraulic, înlocuire componente uzate, purjare și rodaj plăcuțe noi.',
      nodesJson: FRANE_NODES as any,
      edgesJson: FRANE_EDGES as any,
    },
    {
      title: 'UC3 — Revizie Cutie de Viteze Manuală',
      description: 'Protocol revizie cutie viteze manuală: diagnosticare simptome și probă de drum, verificare ulei (culoare, particule metalice), demontare cutie, inspecție ambreiaj și volant motor, reparare și reasamblare.',
      nodesJson: CUTIE_NODES as any,
      edgesJson: CUTIE_EDGES as any,
    },
  ];

  console.log('\n⚙️  Creare process flows...');
  for (const flow of flows) {
    const existing = await prisma.processFlow.findFirst({ where: { title: flow.title } });
    if (!existing) {
      await prisma.processFlow.create({ data: flow });
      console.log('  ✅ Flow:', flow.title);
    } else {
      console.log('  ⏭️  Flow există:', flow.title);
    }
  }

  // ── 4. Past Jobs + Steps ──────────────────────────────────────────────────
  console.log('\n⚙️  Creare joburi demo...');
  for (const jobData of PAST_JOBS) {
    const existing = await prisma.job.findFirst({
      where: { teamId: team.id, title: jobData.title },
    });
    if (existing) {
      console.log('  ⏭️  Job există:', jobData.title.slice(0, 60));
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
    console.log('  ✅ Job:', jobData.title.slice(0, 60));
  }

  // ── 5. Incidents + Embeddings ─────────────────────────────────────────────
  const baseJob = await prisma.job.findFirst({ where: { teamId: team.id } });
  if (!baseJob) throw new Error('Nu există niciun job pentru a lega incidentele');

  console.log('\n⚙️  Generez embeddings pentru', ALL_INCIDENTS.length, 'incidente (OpenAI)...\n');

  for (const inc of ALL_INCIDENTS) {
    const existing = await prisma.incident.findFirst({
      where: { teamId: team.id, title: inc.title },
    });
    if (existing) {
      console.log('  ⏭️  Incident există:', inc.title.slice(0, 65));
      continue;
    }

    const embeddingText = buildEmbeddingText(inc);

    const incident = await prisma.incident.create({
      data: {
        teamId: team.id,
        jobId: baseJob.id,
        reportedByUserId: user.id,
        taskName: inc.taskName,
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

    console.log('  ✅', inc.title.slice(0, 70));
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🎉 Seed automotive complet!\n');
  console.log('  Login:     ', DEMO_EMAIL);
  console.log('  Parola:    ', DEMO_PASSWORD);
  console.log('  Team ID:   ', team.id);
  console.log('  Flows:      UC1 — Motor | UC2 — Frâne | UC3 — Cutie Viteze');
  console.log('  Incidente: ', ALL_INCIDENTS.length, 'incidente cu embeddings RAG');
  console.log('    UC1 Motor: 12 incidente (INC-01 … INC-12)');
  console.log('    UC2 Frâne: 4 incidente (INC-13 … INC-16)');
  console.log('    UC3 Cutie: 2 incidente (INC-17, INC-18)');
  console.log('  Joburi:    ', PAST_JOBS.length, 'intervenții anterioare');
  console.log('\n  ➜ Deschide builder-ul, selectează un flow și apasă "Run RAG Simulation"');
  console.log('    RAG va găsi incidentele relevante pentru fiecare nod și va sugera soluții!');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch((e) => { console.error('❌ Seed eșuat:', e); process.exit(1); });
