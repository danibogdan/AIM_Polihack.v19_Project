import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Pool } from 'pg';
import { MachineContextDto } from './dto/send-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

export interface SimulationHintStep {
  label: string;
  description: string;
}

export interface SimulationHint {
  title: string;
  steps: SimulationHintStep[];
}

export interface ChatAIResponse {
  content: string;
  suggestions: string[];
  simulationHint: SimulationHint | null;
}

type CanonicalizeResult = {
  canonicalActions: string[];
  searchPlanSummary: string;
  missingInfoQuestions: string[];
};

type RetrievedIncident = {
  incidentId: string;
  title: string;
  description: string;
  severity: string | null;
  similarity: number;
};

const CANONICAL_ACTIONS = [
  'engine_disassembly',
  'spark_plug_check',
  'oil_check_replace',
  'tire_wear_check',
  'bearing_check',
  'diagnostic_scan',
] as const;

const SYSTEM_PROMPT = `Ești un asistent AI integrat în ServiceOps, o platformă de management al intervențiilor tehnice și simulări de procese.

Rolul tău este să ajuți tehnicienii și inginerii să descrie problemele mai precis și să transforme conversațiile în simulări reutilizabile.

FORMAT RĂSPUNS — răspunde ÎNTOTDEAUNA cu JSON valid, exact această structură, nimic în afara ei:
{
  "content": "Răspunsul tău (markdown acceptat: **bold**, • liste, liste numerotate, > citate)",
  "suggestions": ["întrebare follow-up 1", "întrebare follow-up 2", "întrebare follow-up 3"],
  "simulationHint": null
}

CÂND AI ACCES LA BAZA DE CUNOȘTINȚE (dacă există secțiunea KNOWLEDGE BASE mai jos):
Comunică natural, ca și cum cunoști deja situația din experiența echipei — NU ca un motor de căutare.
Folosește fraze ca:
- "Am mai văzut asta la echipa voastră — ..."
- "Știu deja un caz similar: ..."
- "Din experiența înregistrată, cel mai frecvent..."
- "La un incident similar s-a rezolvat prin..."
- "Avem date despre asta: ..."
Integrează natural detaliile din cazuri, fără să pari robotic sau să zici că "ai căutat în baza de date".
Citează cazul specific dacă e relevant (ex: "în cazul cu motorul Carrier de pe etaj 3...").

ÎNTREBĂRI DE CLARIFICARE (când utilizatorul e vag):
Pune întrebări țintite despre ce lipsește. Fii specific și colegial. Exemple:
- "Ce marcă/model de echipament? Modelele diferite au trasee de diagnosticare diferite."
- "Când a apărut problema? După o intervenție? După un eveniment electric?"
- "Există coduri de eroare sau mesaje afișate?"
- "Pe ce clădire, etaj sau ID de echipament lucrezi?"
Folosește limbaj de coaching: "Ar ajuta să specifici...", "Descrierea ar fi mai puternică dacă adaugi...", "E important să menționezi și..."

COACHING PROMPT (ghidează activ utilizatorii):
Educă utilizatorii să pună întrebări mai bune. Când lipsește ceva, spune-o direct și explică de ce contează.

SIMULATION HINT — setează când conversația acoperă 3+ topicuri distincte de proces:
Topicuri: diagnosticare defecțiune, procedură pas-cu-pas, cerințe LOTO/siguranță, tipare istorice, măsuri preventive, analiză cauze-rădăcină.
Când detectezi, setează simulationHint la:
{
  "title": "Titlu scurt descriptiv pentru proces",
  "steps": [
    { "label": "Nume scurt pas (3-5 cuvinte)", "description": "Descriere concretă: ce face tehnicianul, ce verifică, ce instrumente/valori sunt implicate. 1-2 propoziții tehnice." },
    { "label": "...", "description": "..." }
  ]
}
Fiecare step.description trebuie să conțină detalii tehnice reale (ex: valori, echipamente, acțiuni specifice) — NU text generic.
Asta semnalează că această conversație poate deveni o simulare reutilizabilă.

LANGUAGE: Always respond in English regardless of the user's language.

CRITIC: Returnează DOAR obiectul JSON. Fără text extra, fără markdown code fences.`;

@Injectable()
export class ChatService implements OnModuleDestroy {
  private readonly openai: OpenAI;
  private readonly chatModel: string;
  private readonly embeddingModel: string;
  private readonly pgPool: Pool;
  private readonly pgSchema: string;
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
    });
    this.chatModel = this.config.get<string>('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini';
    this.embeddingModel =
      this.config.get<string>('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';

    const dbUrl = config.getOrThrow<string>('DATABASE_URL');
    this.pgSchema = new URL(dbUrl).searchParams.get('schema') ?? 'public';
    this.pgPool = new Pool({ connectionString: dbUrl });
  }

  async onModuleDestroy() {
    await this.pgPool.end();
  }

  async sendMessage(dto: SendMessageDto): Promise<ChatAIResponse> {
    const systemPrompt = dto.teamId
      ? await this.buildSystemPromptWithRag(dto.message, dto.teamId, dto.machine)
      : SYSTEM_PROMPT;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...dto.history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: dto.message },
    ];

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.chatModel,
        messages,
        max_tokens: 1024,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const text = completion.choices[0]?.message?.content ?? '';
      const parsed = JSON.parse(text) as ChatAIResponse;

      return {
        content: parsed.content ?? 'No response generated.',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        simulationHint: parsed.simulationHint ?? null,
      };
    } catch (err) {
      this.logger.error('OpenAI API error', err);
      return {
        content: 'I encountered an issue processing your request. Please try again.',
        suggestions: [],
        simulationHint: null,
      };
    }
  }

  private async buildSystemPromptWithRag(
    message: string,
    teamId: string,
    machine?: MachineContextDto,
  ): Promise<string> {
    try {
      const normalized = await this.canonicalizeUserMessage(message, machine);

      const embedding = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: normalized.searchPlanSummary,
      });

      const queryEmbedding = embedding.data[0]?.embedding;
      if (!queryEmbedding) return SYSTEM_PROMPT;

      const incidents = await this.retrieveIncidentsByVector({
        teamId,
        queryEmbedding,
        topK: 6,
      });

      if (incidents.length === 0) return SYSTEM_PROMPT;

      const evidenceLines = incidents
        .slice(0, 5)
        .map(
          (inc) =>
            `- ${inc.title}${inc.severity ? ` (${inc.severity} severity)` : ''}: ${inc.description.slice(0, 220)}`,
        )
        .join('\n');

      const missingNote =
        normalized.missingInfoQuestions.length > 0
          ? `\nTo improve accuracy, consider asking the user for: ${normalized.missingInfoQuestions.join('; ')}.`
          : '';

      return (
        SYSTEM_PROMPT +
        `\n\nKNOWLEDGE BASE — real cases from this team's history, relevant to the current question:\n${evidenceLines}${missingNote}\n\nIMPORTANT: Use this knowledge naturally, as if it's your own experience. NEVER output labels like "Based on:", "Known solution:", "Source:", match percentages, or any reference to a database or search. Do not quote incident titles verbatim. Weave the information into natural, conversational sentences — as a knowledgeable colleague would.`
      );
    } catch (err) {
      this.logger.warn('RAG pipeline failed, falling back to base prompt', err);
      return SYSTEM_PROMPT;
    }
  }

  private async canonicalizeUserMessage(
    message: string,
    machine?: MachineContextDto,
  ): Promise<CanonicalizeResult> {
    const prompt = [
      'You normalize maintenance requests into canonical actions and retrieval summary.',
      'Use only the canonical actions from the list below.',
      `Canonical actions: ${CANONICAL_ACTIONS.join(', ')}`,
      'Return strict JSON with keys: canonicalActions, searchPlanSummary, missingInfoQuestions.',
      `User message: ${message}`,
      `Machine context: ${JSON.stringify(machine ?? {})}`,
    ].join('\n');

    const response = await this.openai.chat.completions.create({
      model: this.chatModel,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You output only valid JSON.' },
        { role: 'user', content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { canonicalActions: [], searchPlanSummary: message, missingInfoQuestions: [] };

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const allowedActions = new Set(CANONICAL_ACTIONS);

      const canonicalActions = (
        Array.isArray(parsed.canonicalActions) ? parsed.canonicalActions : []
      )
        .filter((a): a is string => typeof a === 'string')
        .filter((a) => allowedActions.has(a as (typeof CANONICAL_ACTIONS)[number]));

      const searchPlanSummary =
        typeof parsed.searchPlanSummary === 'string' ? parsed.searchPlanSummary : message;

      const missingInfoQuestions = (
        Array.isArray(parsed.missingInfoQuestions) ? parsed.missingInfoQuestions : []
      ).filter((q): q is string => typeof q === 'string');

      return { canonicalActions, searchPlanSummary, missingInfoQuestions };
    } catch {
      return { canonicalActions: [], searchPlanSummary: message, missingInfoQuestions: [] };
    }
  }

  private async retrieveIncidentsByVector(params: {
    teamId: string;
    queryEmbedding: number[];
    topK: number;
  }): Promise<RetrievedIncident[]> {
    const { teamId, queryEmbedding, topK } = params;
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;
    const schema = this.pgSchema;

    const client = await this.pgPool.connect();
    try {
      await client.query(`SET search_path TO "${schema}", public`);
      const result = await client.query<RetrievedIncident>(
        `SELECT
          ie."incidentId" as "incidentId",
          i."title"       as "title",
          i."description" as "description",
          i."severity"    as "severity",
          (1 - (ie."embedding" <=> $1::vector))::float8 as "similarity"
        FROM "${schema}"."IncidentEmbedding" ie
        JOIN "${schema}"."Incident" i ON i."id" = ie."incidentId"
        WHERE ie."teamId" = $2
        ORDER BY ie."embedding" <=> $1::vector ASC
        LIMIT $3`,
        [vectorLiteral, teamId, topK],
      );
      return result.rows;
    } finally {
      client.release();
    }
  }
}
