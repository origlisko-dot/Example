/**
 * Compliance-by-configuration.
 *
 * Every legally-sensitive behavior is a first-class, default-SAFE switch here,
 * so turning compliance on is a one-line change — never a rebuild. Each call
 * snapshots the values that applied to it (see `call_attempts.ai_disclosed`),
 * so history stays truthful even after a toggle flips.
 *
 * Owner's current operational choice: AI-disclosure OFF. It is fully built and
 * one flag away from ON. See README legal flag.
 */

export interface DisclosureConfig {
  /** when true, the bot opens with the Hebrew disclosure line below */
  enabled: boolean;
  /** Hebrew disclosure spoken at the very start of the call */
  text: string;
}

export interface CallingWindow {
  timezone: string; // IANA, e.g. "Asia/Jerusalem"
  /** local start/end hour (24h) on a normal weekday */
  startHour: number;
  endHour: number;
  /** Friday closes early (erev Shabbat); null = closed all day */
  fridayEndHour: number | null;
  /** Saturday (Shabbat) — off by default */
  saturdayOpen: boolean;
}

export interface ComplianceConfig {
  disclosure: DisclosureConfig;
  callingWindow: CallingWindow;
  /** never dial a lead lacking a documented consent record when true */
  requireConsentRecord: boolean;
  /** cross-check against the imported "Do Not Call" list before dialing */
  dncCheckEnabled: boolean;
  recording: {
    enabled: boolean; // OFF by default — owner does not want bulk storage
    retentionDays: number;
  };
  /** Hebrew phrases that, if heard, trigger immediate permanent opt-out */
  optOutPhrases: string[];
}

export const DEFAULT_COMPLIANCE: ComplianceConfig = {
  disclosure: {
    // Built ON-capable; shipped OFF per the owner's explicit instruction.
    enabled: false,
    text:
      "שלום, מדבר עוזר דיגיטלי אוטומטי מטעם העסק. " +
      "פנית אלינו וביקשת שנחזור אליך — נוח לך שנמשיך כמה דקות?",
  },
  callingWindow: {
    timezone: "Asia/Jerusalem",
    startHour: 9,
    endHour: 20,
    fridayEndHour: 14,
    saturdayOpen: false,
  },
  requireConsentRecord: true,
  dncCheckEnabled: true,
  recording: {
    enabled: false,
    retentionDays: 30,
  },
  optOutPhrases: [
    "הסר",
    "הסירו אותי",
    "תוריד אותי",
    "תורידו אותי",
    "אל תתקשרו",
    "אל תתקשר אליי",
    "אל תתקשרו אליי",
    "תפסיקו להתקשר",
    "תפסיק להתקשר",
    "להסיר מהרשימה",
    "תורידו אותי מהרשימה",
    "לא מעוניין שתתקשרו",
  ],
};

/** Parts of a Date as seen in a given IANA timezone. */
function zonedParts(at: Date, timezone: string): { weekday: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    weekday: weekdayMap[parts.weekday as string] ?? 0,
    hour: parseInt(parts.hour as string, 10) % 24,
    minute: parseInt(parts.minute as string, 10),
  };
}

/**
 * Is it currently allowed to dial, per the calling window?
 * Belt-and-suspenders: enforce both when scheduling and at dispatch time,
 * because a retry computed hours earlier can drift past the boundary.
 */
export function isWithinCallingWindow(
  at: Date,
  window: CallingWindow = DEFAULT_COMPLIANCE.callingWindow,
): boolean {
  const { weekday, hour } = zonedParts(at, window.timezone);

  if (weekday === 6) return window.saturdayOpen; // Shabbat
  if (weekday === 5) {
    return window.fridayEndHour !== null && hour >= window.startHour && hour < window.fridayEndHour;
  }
  // Sun–Thu
  return hour >= window.startHour && hour < window.endHour;
}

/** Detect a Hebrew opt-out intent in transcribed caller speech. */
export function detectOptOut(
  text: string,
  phrases: string[] = DEFAULT_COMPLIANCE.optOutPhrases,
): boolean {
  const normalized = text.replace(/[^֐-׿\s]/g, " ").replace(/\s+/g, " ").trim();
  return phrases.some((p) => normalized.includes(p));
}
