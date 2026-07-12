/**
 * Campaign = one lead "topic" (out of ~20) with its own Hebrew script and
 * qualification logic. The operator picks one campaign per run; the
 * promptCompiler turns it into the per-call system prompt + the structured
 * `record_outcome` tool schema the LLM must fill at the end of the call.
 *
 * Scripts are STRUCTURED, not free text, so the operator can edit blocks in the
 * panel without touching the master prompt template, and so outcomes come from
 * a tool call — never from parsing the transcript.
 */

export type OutcomeFieldType = "bool" | "string" | "number" | "choice";

export interface OutcomeField {
  /** key in the structured outcome object, e.g. "interested" */
  key: string;
  type: OutcomeFieldType;
  /** Hebrew description the LLM uses to decide what to fill */
  description: string;
  required: boolean;
  /** for type "choice" */
  choices?: string[];
}

export type QuestionType = "yesno" | "open" | "number" | "choice";

export interface QualifyingQuestion {
  id: string;
  /** Hebrew question text, may contain {{variables}} */
  text: string;
  type: QuestionType;
  required: boolean;
  choices?: string[];
}

export interface ObjectionHandler {
  /** short label of the objection, e.g. "אין זמן עכשיו" */
  trigger: string;
  /** Hebrew response the bot should give */
  response: string;
}

export interface VoiceSettings {
  provider: "cartesia" | "elevenlabs";
  voiceId: string;
  /** 0.5–2.0, 1 = natural */
  speed?: number;
  model?: string;
}

/**
 * Final disposition buckets — stable across all campaigns so results, exports
 * and the suppression flow are uniform. The LLM fills `outcome_schema`; the
 * orchestrator maps it to one of these via the campaign criteria.
 */
export type Disposition =
  | "qualified_for_human" // relevant — hand to a human rep
  | "interested" // interested but not yet a hand-off
  | "callback_later" // asked to be called another time
  | "not_relevant" // not interested / not a fit
  | "opted_out" // asked never to be contacted again
  | "no_answer"
  | "wrong_number"
  | "failed";

export interface Campaign {
  id: string;
  /** pelozen topic name, Hebrew, e.g. "הלוואות לעסקים" */
  name: string;
  /** maps to the topic as it appears in pelozen (for the scraper) */
  pelozenTopicRef?: string;
  status: "draft" | "active" | "archived";
  locale: "he-IL";

  // ── script blocks (Hebrew) ──
  introScript: string;
  valueProp: string;
  qualifyingQuestions: QualifyingQuestion[];
  objectionHandlers: ObjectionHandler[];
  closingScript: string;

  // ── outcome logic ──
  outcomeSchema: OutcomeField[];
  /**
   * Boolean expressions over outcome keys, evaluated by the orchestrator to
   * pick a Disposition. Kept as data (not code) so non-devs can reason about
   * them and so they're versioned with the campaign.
   * e.g. successExpr: "interested == true && wants_callback == true"
   */
  successExpr: string;
  disqualifyExpr: string;

  // ── voice + behavior ──
  voice: VoiceSettings;
  /** lead fields injected as {{name}} into scripts */
  dynamicVariables: string[];
  maxCallDurationSec: number;

  // ── compliance snapshot (per-topic disclosure override) ──
  aiDisclosureOn: boolean;

  // ── operational ──
  callingWindowId: string;
  retryPolicyId: string;

  /** in-flight calls pin to the version they started with */
  version: number;
}
