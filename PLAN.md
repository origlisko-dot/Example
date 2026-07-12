# Pelozen Caller — תוכניות עבודה

מסמך זה מרכז **תוכניות (Plans)** לפיתוח המערכת.  
כל תוכנית חדשה מקבלת מספר, תאריך ויום בשבוע, וסטטוס ברור.

> **כלל:** אחרי כל שינוי בקוד / env / workflow — עדכן גם [`BRAIN.md`](./BRAIN.md) (קצר ולעניין).

---

## אינדקס תוכניות

| # | כותרת | תאריך | יום | סטטוס |
|---|--------|--------|-----|--------|
| 001 | חיווט שיחה חיה — Retell + Twilio + Orchestrator | 2026-07-12 | ראשון | 🟢 קוד מוכן — ממתין Twilio BYOC |
| 001b | GSM Gateway + סים ישראלי → Pipecat (מקביל ל-001) | 2026-07-12 | ראשון | 🟢 קוד מוכן — ממתין קופסת GSM + Asterisk |
| 003 | Realtime במonitor (Supabase) | — | — | ⬜ עתידי |
| 004 | Retry policy + חיוג חוזר | — | — | ⬜ עתידי |
| 005 | DNC import + בדיקה לפני dial | — | — | ⬜ עתידי |

**איך להוסיף תוכנית חדשה:**  
1. הוסף שורה לאינדקס (מספר עוקב, תאריך `YYYY-MM-DD`, יום בעברית).  
2. הוסף סעיף `## Plan NNN — …` למטה.  
3. רשום ב-`BRAIN.md` שורת יצירה/עדכון.

---

## Plan 001 — חיווט שיחה חיה (Retell + Twilio + Orchestrator)

**תאריך:** 2026-07-12 (ראשון)  
**סטטוס:** 🟢 קוד מוכן — שלב 1 (Twilio BYOC) ידני  
**מטרה:** לעבור מסימולציה (`simulateNextCall`) לשיחות אמיתיות — קו אחד, רצף, תוצאה מובנית ב-DB.

### רקע — מה כבר עובד

| רכיב | סטטוס |
|------|--------|
| פאנל web (טעינה, monitor, results, editor) | ✅ |
| `parsePastedLeads` + validation | ✅ |
| Scraper pelozen (Playwright + session) | ✅ |
| 22 תסריטים + seed | ✅ |
| DB (12 טבלאות) | ✅ |
| `SequentialRunController` + gates ציות | ✅ |
| `RetellProvider` (קוד) | ✅ — לא מחובר ל-entry point |
| `simulateNextCall` | ✅ — מחליף טלפוניה ב-dev |

### פערים שחוסמים שיחה חיה

1. **`from_number`** — מספר Twilio/gateway לא רשום / לא ב-env.
2. **`buildOrchestrator()`** — עדיין `AsteriskGsmProvider` stub, לא `RetellProvider`.
3. **אין `POST /run`** — web יוצר `call_attempts` queued אבל orchestrator לא מריץ dial loop.
4. **Pause/Stop** — Monitor מעדכן `runs.state` ב-DB בלבד; orchestrator לא קורא controls משותפים.
5. **Post-call analysis** — Retell `custom_analysis_data` צריך ליישור עם `outcomeSchema` per campaign.

---

### שלב 2 — Orchestrator: RetellProvider כ-provider ברירת מחדל

- [x] `orchestrator/src/config.ts` — block retell
- [x] `orchestrator/src/telephonyFactory.ts` — בחירת Retell/Asterisk
- [x] `orchestrator/src/orchestratorApp.ts` — `buildOrchestrator()`

### שלב 3 — Endpoint `POST /run/:runId`

- [x] `orchestrator/src/runWorker.ts` — טעינה מ-DB + `controller.run()`
- [x] `orchestrator/src/server.ts` — `POST /run/:runId` async, idempotency 409

### שלב 4 — Web: חיבור Start → Orchestrator

- [x] `web/app/actions/run.ts` — `triggerOrchestratorRun` אחרי startRun + resume

### שלב 5 — Pause / Stop סינכרוני

- [x] `Repo.getRunState` + `runController.checkHalt()` — קורא DB כל lead
- [x] `acquireCallAttempt` — ממחזר queued attempts מה-web

### שלב 1 — Twilio + Retell BYOC (תשתית חיצונית)

**מדריך מלא:** [`docs/TWILIO_RETELL_SETUP.md`](./docs/TWILIO_RETELL_SETUP.md) (2026-07-12)

**בעלים (ידני — עדיין נדרש):**

- [ ] **A.** Twilio Elastic SIP Trunk — Termination URI + IP ACL `18.98.16.120/30` (או Credential List)
- [ ] **A4.** שיוך מספר ל-Trunk (E.164)
- [ ] **B.** Geographic Permissions → Elastic SIP → **Israel ON**
- [ ] **C.** Retell Import מספר + Outbound Agent + `{{system_prompt}}`
- [ ] **C3.** Post-Call Analysis: `interested`, `wants_callback`, `disposition`
- [ ] **D.** Smoke test ב-Retell Dashboard → שיחה אליך
- [ ] **E.** `.env`: `RETELL_*` + `ORCHESTRATOR_URL` → `GET /health` עם `retell: true`

**Env (`.env`):**

```env
RETELL_API_KEY=
RETELL_AGENT_ID=
RETELL_FROM_NUMBER=+972...        # = המספר המיובא ב-Retell
CALLER_ID=+972...                 # יכול להיות זהה
ORCHESTRATOR_URL=http://localhost:8080
```

**Definition of Done:** Retell Test Call + `curl /health` → `retell:true` + שיחה אחת דרך הפאנל (בלי סמלץ).

---

### שלב 2 — Orchestrator: RetellProvider כ-provider ברירת מחדל

**קבצים:**

| קובץ | שינוי |
|------|--------|
| `orchestrator/src/config.ts` | הוסף `retell: { apiKey, agentId, fromNumber, pollIntervalMs?, maxPollMs? }` |
| `orchestrator/src/index.ts` | `buildOrchestrator()`: אם `RETELL_API_KEY` → `RetellProvider`, אחרת stub/warn |
| `.env.example` | משתני Retell |

**לוגיקה:**

```typescript
const telephony = cfg.retell.apiKey
  ? new RetellProvider({ apiKey, fromNumber, agentId, ... })
  : new AsteriskGsmProvider(...); // fallback / dev
```

**Definition of Done:** `buildOrchestrator().telephony.kind === "voip_sip"` עם env מלא.

---

### שלב 3 — Endpoint `POST /run/:runId`

**קבצים:**

| קובץ | שינוי |
|------|--------|
| `orchestrator/src/server.ts` | `POST /run/:runId` — טוען run, campaign, leads; מריץ `controller.run()` ברקע |
| `orchestrator/src/runWorker.ts` (חדש) | לוגיקת טעינה מ-DB + error handling + עדכון run state |

**Flow:**

```
POST /run/:runId
  → SELECT runs WHERE id AND state IN ('running','paused')
  → SELECT campaign (version pinned או latest)
  → SELECT leads JOIN call_attempts WHERE run_id AND state='queued'
  → SequentialRunController.run(runId, campaign, leads)
  → on complete: runs.state = 'done'
  → on error: runs.state + audit_log
```

**Response:** `202 Accepted { runId, queued: N }` — הרצה async (לא block HTTP).

**Definition of Done:** curl ל-`/run/:id` מתחיל loop; `call_attempts` עוברים מ-queued → completed/failed.

---

### שלב 4 — Web: חיבור Start → Orchestrator

**קבצים:**

| קובץ | שינוי |
|------|--------|
| `web/app/actions/run.ts` | אחרי `startRun`, `fetch(ORCHESTRATOR_URL/run/:runId, { method:'POST' })` |
| `web/app/run/[topic]/LoadBatch.tsx` | (אופציונלי) הצג שגיאה אם orchestrator לא זמין |
| `.env.example` / web | `NEXT_PUBLIC_ORCHESTRATOR_URL` (קיים) |

**Definition of Done:** לחיצה "התחל חיוג" → monitor מתעדכן מ-shיחות אמיתיות (לא רק simulate).

---

### שלב 5 — Pause / Stop סינכרוני

**בעיה:** `Monitor` קורא `setRunState` ישירות ל-Supabase; orchestrator קורא `RunControls` בזיכרון.

**פתרון (מומלץ):**

| אופציה | תיאור |
|--------|--------|
| A — DB polling | orchestrator בודק `runs.state` בתחילת כל lead ב-loop |
| B — shared controls API | `POST /run/:id/pause|stop` מעדכן `controlsState` + DB |

**Implementation (A — פשוט יותר):**

- `runController`: לפני כל lead, `repo.getRunState(runId)` → אם paused/stopped, break.
- `setRunState` ב-web נשאר כמו היום.

**קבצים:** `repo.ts`, `supabaseRepo.ts`, `runController.ts`

**Definition of Done:** "עצור" במonitor עוצר dial loop תוך ≤1 lead.

---

### שלב 6 — Post-call analysis ↔ outcomeSchema

**קבצים:**

| קובץ | שינוי |
|------|--------|
| `orchestrator/src/providers/retellProvider.ts` | map `custom_analysis_data` → `structured`; fallback אם חסר |
| `orchestrator/src/scripts/retellSyncAnalysis.ts` (חדש, אופציונלי) | סקרipt לייצוא schema ל-Retell API |

**Definition of Done:** `classifyDisposition` מקבל structured מלא; outcomes ב-DB תואמים סימולציה.

---

### שלב 7 — בדיקות + smoke

- [ ] `npm test` ב-orchestrator (22+ tests) — green
- [ ] שיחת test אחת ל-mספר שלך
- [ ] opt-out בעברית → `suppression_list`
- [ ] מחוץ לחלון חיוג → run paused
- [ ] export CSV עם מספר מלא ל-qualified

**Definition of Done:** run של 3 לידים אמיתיים → results + export תקין.

---

### סיכונים

| סיכון | mitigation |
|-------|------------|
| Retell API fields השתנו | verify מול docs; BUILD-DAY TODO בקוד |
| Twilio BYOC latency | test call לפני batch |
| run כפול (double POST /run) | idempotency: אם run כבר `running` עם worker פעיל → 409 |
| on-call cost | max 20 leads, `maxCallDurationSec` per campaign |

---

### סדר ביצוע מומלץ

```
1. Env + Retell/Twilio (ידני)
2. config.ts + RetellProvider wiring
3. POST /run/:runId
4. web startRun → POST /run
5. Pause/Stop via DB
6. Post-call analysis alignment
7. Smoke test
```

**הערכת מורכבות:** 6 קבצים orchestrator, 2 web, 1 env — שינוי ממוקד, לא refactor.

---

## Plan 001b — GSM + סים ישראלי → Pipecat (מקביל ל-Retell)

**תאריך:** 2026-07-12 (ראשון)  
**סטטוס:** 🟢 קוד מוכן — שלב חומרה (GSM gateway + Asterisk) ידני  
**מטרה:** לחייג עם **אותו מספר הסים** — בלי Port, בלי מספר חדש — במקביל למסלול Retell/Twilio.

### ארכיטקטורה

```
TELEPHONY_MODE=gsm
orchestrator → GsmPipelineProvider → pipeline/dial_server.py
  ├─ PIPELINE_MODE=sim      (dev — ללא חומרה)
  └─ PIPELINE_MODE=asterisk (ARI originate → GSM gateway → SIM)
```

**מדריך:** [`docs/GSM_SETUP.md`](./docs/GSM_SETUP.md)

### קוד (הושלם)

- [x] `TELEPHONY_MODE=auto|retell|gsm` — `config.ts`, `telephonyStatus.ts`
- [x] `GsmPipelineProvider` — HTTP ל-pipeline
- [x] `pipeline/dial_server.py` — `POST /dial`, `GET /calls/{id}`, modes sim/asterisk
- [x] `GET /health` + `POST /run` — בודקים `telephonyReady` לפי mode (לא Retell בלבד)
- [x] `npm run dev:pipeline` — root `package.json`
- [x] tests — `telephonyStatus.test.ts`

### ידני (עדיין נדרש)

- [ ] קניית GSM gateway + הכנסת SIM
- [ ] Asterisk + PJSIP endpoint (`GSM_GATEWAY_ENDPOINT`)
- [ ] `PIPELINE_MODE=asterisk` + `ASTERISK_ARI_*`
- [ ] Pipecat audio bridge (Stasis → `agent.py`) — שיחה קולית אמיתית

### Env (GSM)

```env
TELEPHONY_MODE=gsm
PIPELINE_URL=http://127.0.0.1:8090
PIPELINE_MODE=sim          # dev; asterisk ב-production
CALLER_ID=+972...          # מספר הסים
```

**Definition of Done (dev):** `curl /health` → `mode=gsm, telephonyReady=true` + run מהפאנל דרך pipeline sim.  
**Definition of Done (prod):** שיחה אמיתית דרך הסים → outcome ב-DB.

---

## Plan 002 — Auth + RLS (עתידי)

**תאריך:** —  
**סטטוס:** ⬜ עתידי  

- Supabase Auth (email/OAuth)
- web: anon key + session; הסר service-role מה-server actions
- RLS policies per `profiles.role`
- orchestrator: service-role נשאר

---

## Plan 003 — Realtime Monitor (עתידי)

**תאריך:** —  
**סטטוס:** ⬜ עתידי  

- החלפת polling 3s ב-Supabase Realtime על `call_attempts` / `outcomes`
- `Monitor.tsx`: subscribe + unsubscribe

---

## Plan 004 — Retry Policy (עתידי)

**תאריך:** —  
**סטטוס:** ⬜ עתידי  

- שימוש ב-`retry_policies` + `attempt_no`
- scheduler: no_answer → `scheduled_for` + backoff
- runController: dial רק attempts due

---

## Plan 005 — DNC Import (עתידי)

**תאריׁ:** —  
**סטטוס:** ⬜ עתידי  

- ייבוא מאגר "אל תתקשרו אליי"
- gate: `dncCheckEnabled` ב-`DEFAULT_COMPLIANCE`
- `suppression_list.reason = 'dnc_registry'`

---

## היסטוריית עדכוני מסמך זה

| תאריך | יום | שינוי |
|--------|-----|--------|
| 2026-07-12 | ראשון | Plan 001: מימוש קוד (Retell wiring, POST /run, web trigger, DB pause) |
| 2026-07-12 | ראשון | Plan 001b: טלפוניה מקבילה — `TELEPHONY_MODE`, GSM pipeline, `dial_server.py` |
| 2026-07-12 | ראשון | שלב 1: `docs/TWILIO_RETELL_SETUP.md` — checklist Twilio BYOC |
| 2026-07-12 | ראשון | `docs/GSM_SETUP.md` — מסלול SIM/GSM |
