# Pelozen Caller — BRAIN (זיכרון פרויקט)

**כלל:** אחרי **כל** שינוי — בקוד, env, workflow, DB, Retell/Twilio — הוסף כאן רשומה קצרה.  
פורmat: `YYYY-MM-DD (יום) · מה · איפה · למה`

---

## מצב נוכחי (snapshot)

| תחום | מצב |
|------|-----|
| Monorepo | `shared`, `orchestrator`, `web`, `pipeline`, `supabase` |
| UI | ✅ עובד — טעינה, scraper, monitor, results, editor (ראה צילומי מסך 2026-07-12) |
| DB | ✅ `0001_init.sql` — 12 טבלאות |
| ליבה נבדקת | 20 unit tests (phone, parse, outcomeEval, runController, telephonyStatus) |
| טלפוניה | ✅ **שני מסלולים במקביל:** Retell (Port/Twilio) **או** GSM/Pipecat (SIM) — `TELEPHONY_MODE` |
| שיחה חיה | ⏳ Retell: Twilio BYOC + `RETELL_*` · GSM: קופסה+SIM או `PIPELINE_MODE=sim` ל-dev |
| תוכנית | [`PLAN.md`](./PLAN.md) Plan 001 + 001b — 🟢 קוד / ⏳ תשתית חיצונית |

---

## ארכיטקטורה בקצרה

```
web (Next.js RTL)
  ├─ loadBatch / startRun / getRunSnapshot  → Supabase (service-role)
  └─ POST /scrape → orchestrator

orchestrator
  ├─ SequentialRunController (gates → dial → classify → persist)
  ├─ POST /run/:runId → runWorker → SequentialRunController
  ├─ TELEPHONY_MODE=auto|retell|gsm
  │   ├─ retell → RetellProvider → Retell API → Twilio BYOC
  │   └─ gsm    → GsmPipelineProvider → pipeline/dial_server.py (sim | asterisk)
  └─ PelozenScraperSource (Playwright)

pipeline
  └─ dial_server.py — FastAPI dial + poll (sim dev / ARI originate prod)

shared
  ├─ phone.ts, leadParse.ts, compliance/config.ts, types
```

**God nodes:** `runController.ts`, `compliance/config.ts`, `Repo`

---

## יומן שינויים

### 2026-07-12 (ראשון)

| זמן | מה | איפה | למה |
|-----|-----|------|-----|
| — | יצירת `PLAN.md` | `/PLAN.md` | תוכנית Plan 001 (שיחה חיה) + אינדקס לתוכניות עתידיות 002–005 |
| — | יצירת `BRAIN.md` | `/BRAIN.md` | תיעוד מתמשך — כל שינוי נרשם כאן |
| — | סקירת קוד + צילומי UI | — | אימות: pipeline מ-simulate עובד; חסר orchestrator dial |

### 2026-07-12 (ראשון) — Plan 001 מימוש קוד

| זמן | מה | איפה | למה |
|-----|-----|------|-----|
| — | Retell config + telephonyFactory | `config.ts`, `telephonyFactory.ts` | בחירת provider לפי env |
| — | buildOrchestrator | `orchestratorApp.ts` | הפרדה מ-index, בלי circular import |
| — | POST /run/:runId | `server.ts`, `runWorker.ts` | dial loop async מה-web |
| — | acquireCallAttempt + getRunState | `repo.ts`, `supabaseRepo.ts`, `runController.ts` | ממחזר queued attempts; pause/stop מ-DB |
| — | triggerOrchestratorRun | `web/app/actions/run.ts` | Start + Resume → orchestrator |
| — | campaignFromRow / leadFromRow | `db/campaignMapper.ts` | טעינת run מ-Supabase |
| — | .env.example | Retell + ORCHESTRATOR_URL | תיעוד env |
| — | 16 tests pass | orchestrator | regression OK |
| — | `docs/TWILIO_RETELL_SETUP.md` | docs/ | checklist Twilio Elastic SIP → Retell → env → smoke |
| 2026-07-12 | ראשון | `docs/TELEPHONY_OPTIONS_IL.md` — חלופות למספר IL (Twilio/Telnyx/SIP/GSM) |

### 2026-07-12 (ראשון) — Plan 001b טלפוניה מקבילה (Retell + GSM)

| זמן | מה | איפה | למה |
|-----|-----|------|-----|
| — | `TELEPHONY_MODE` auto/retell/gsm | `config.ts`, `telephonyStatus.ts` | בחירת מסלול לפי env |
| — | GsmPipelineProvider | `providers/gsmPipelineProvider.ts` | orchestrator → Python pipeline |
| — | dial service | `pipeline/dial_server.py` | sim (dev) + asterisk ARI skeleton |
| — | health/run gates | `server.ts`, `orchestratorApp.ts` | ready לפי mode, לא Retell-only |
| — | docs GSM | `docs/GSM_SETUP.md` | הוראות SIM/GSM בעברית |
| — | dev:pipeline | root `package.json` | הרצת pipeline בקלות |
| — | 20 tests pass | orchestrator | + telephonyStatus |
| 2026-07-13 | שני | `python3` + `setup:pipeline` | Linux: אין `python`; pip --user בלי sudo |
| 2026-07-13 | שני | `smoke:gsm` + POST /smoke/gsm | e2e MemoryRepo→GsmPipeline→dial_server sim | dialed=2 qualified=1 |
| 2026-07-13 | שני | graphify + code-review-graph | 639 / 290 nodes | כלי ניתוח קוד |
| 2026-07-13 | שני | Pipecat bridge seams | `call_context.py`, `bridge.py` | תפר Stasis→agent; bridge_sim עובד |
| 2026-07-13 | שני | Plan 001 שלב 6 Retell | retellAnalysis + sync + smoke:retell | analysis mapping + fallback |

---

## קבצים קריטיים (מפתח)

| נתיב | תפקיד |
|------|--------|
| `shared/src/compliance/config.ts` | ציות — חלון חיוג, opt-out, disclosure |
| `orchestrator/src/orchestrator/runController.ts` | לולאת חיוג + gates |
| `orchestrator/src/providers/retellProvider.ts` | Retell create-call + poll |
| `orchestrator/src/orchestratorApp.ts` | buildOrchestrator — mode-aware telephony |
| `orchestrator/src/runWorker.ts` | POST /run loader |
| `orchestrator/src/server.ts` | HTTP — /scrape, /run/:id, /health |
| `orchestrator/src/telephonyStatus.ts` | resolve mode + health hints |
| `orchestrator/src/providers/gsmPipelineProvider.ts` | GSM/Pipecat HTTP client |
| `pipeline/dial_server.py` | dial + poll (sim / asterisk) |
| `docs/GSM_SETUP.md` | מדריך מסלול SIM |
| `web/app/actions/run.ts` | startRun, simulateNextCall |
| `web/app/actions/loadBatch.ts` | parse + consent + leads |
| `supabase/migrations/0001_init.sql` | schema |

---

## Env — משתנים נדרשים

| משתנה | שימוש | סטטוס |
|--------|--------|--------|
| `SUPABASE_URL` | web + orchestrator | נדרש |
| `SUPABASE_SERVICE_ROLE_KEY` | server actions + orchestrator | נדרש |
| `PHONE_HASH_SECRET` | HMAC לידים | נדרש |
| `PELOZEN_USERNAME/PASSWORD` | scraper | נדרש ל-scrape |
| `NEXT_PUBLIC_ORCHESTRATOR_URL` | web → /scrape | נדרש |
| `TELEPHONY_MODE` | auto / retell / gsm | `auto` |
| `PIPELINE_URL` | GSM path dial service | default localhost:8090 |
| `RETELL_API_KEY` | RetellProvider | ⏳ env נדרש (מסלול 1) |
| `RETELL_AGENT_ID` | RetellProvider | ⏳ env נדרש |
| `RETELL_FROM_NUMBER` | BYOC from_number | ⏳ env נדרש |
| `ORCHESTRATOR_URL` | web → POST /run | ⏳ env נדרש |
| `CALLER_ID` | caller ID לוגי | קיים ב-.env.example |

---

## Workflow יומי (מפעיל)

1. `/` — בחר תחום  
2. `/run/[id]` — הדבק / scrape 20  
3. "התחל חיוג" → `/monitor/[runId]`  
4. (עכשיו) GSM sim או "סמלץ שיחה" · Retell/GSM prod — שיחות אמיתיות  
5. `/results/[id]` + ייצוא CSV  

---

## החלטות עיצוב (לא לשכוח)

1. **Interfaces** — `TelephonyProvider`, `LeadSource`, `Repo` → החלפות בלי לגעת ב-runController  
2. **ציות = config** — `DEFAULT_COMPLIANCE`; snapshot `ai_disclosed` per call  
3. **תוצאה = tool** — `record_outcome`, לא parse transcript  
4. **אין recordings** — transcript טקסט בלבד  
5. **Consent** — `consent_records` לכל lead ב-load  

---

## TODO מיידי

**מסלול 1 — Retell/Twilio:** [`docs/TWILIO_RETELL_SETUP.md`](./docs/TWILIO_RETELL_SETUP.md)  
**מסלול 2 — GSM/SIM:** [`docs/GSM_SETUP.md`](./docs/GSM_SETUP.md)

- [ ] Twilio + Retell BYOC (ידני)
- [ ] GSM gateway + Asterisk (ידני)
- [ ] Pipecat audio bridge (Stasis → agent.py)
- [x] `TELEPHONY_MODE` + GSM pipeline code
- [x] smoke:gsm e2e (MemoryRepo, closed env)
- [x] Pipecat bridge seams + bridge_sim
- [x] Retell post-call analysis mapping + sync script + smoke:retell
- [ ] RTP transport אמיתי ל-agent.py
- [ ] Twilio BYOC ידני + `RETELL_*` אמיתיים
- [x] `telephonyFactory.ts` + `orchestratorApp.ts`
- [x] `server.ts` — POST `/run/:runId` + mode-aware health
- [x] `run.ts` — trigger orchestrator after startRun + resume
- [x] Pause/Stop — sync דרך DB ב-runController
- [ ] smoke test — Retell **או** GSM sim end-to-end מהפאנל

---

## תבנית לרשומה חדשה (העתק)

```
### YYYY-MM-DD (יום)

| זמן | מה | איפה | למה |
|-----|-----|------|-----|
| HH:MM | תיאור קצר | path/file | סיבה בשורה |
```
