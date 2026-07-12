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
| ליבה נבדקת | 22 unit tests (phone, parse, outcomeEval, runController) |
| טלפוניה | ✅ `RetellProvider` מחובר ב-`orchestratorApp`; stub אם env חסר |
| שיחה חיה | ⏳ קוד מוכן — חסר: Twilio BYOC + env `RETELL_*` |
| תוכנית | [`PLAN.md`](./PLAN.md) Plan 001 — 🟢 קוד / ⏳ Twilio |

---

## ארכיטקטורה בקצרה

```
web (Next.js RTL)
  ├─ loadBatch / startRun / getRunSnapshot  → Supabase (service-role)
  └─ POST /scrape → orchestrator

orchestrator
  ├─ SequentialRunController (gates → dial → classify → persist)
  ├─ POST /run/:runId → runWorker → SequentialRunController
  ├─ RetellProvider (default) | AsteriskGsmProvider (fallback)
  └─ PelozenScraperSource (Playwright)

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

---

## קבצים קריטיים (מפתח)

| נתיב | תפקיד |
|------|--------|
| `shared/src/compliance/config.ts` | ציות — חלון חיוג, opt-out, disclosure |
| `orchestrator/src/orchestrator/runController.ts` | לולאת חיוג + gates |
| `orchestrator/src/providers/retellProvider.ts` | Retell create-call + poll |
| `orchestrator/src/orchestratorApp.ts` | buildOrchestrator — Retell default |
| `orchestrator/src/runWorker.ts` | POST /run loader |
| `orchestrator/src/server.ts` | HTTP — /scrape, /run/:id, /health |
| `orchestrator/src/index.ts` | entry — startServer |
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
| `RETELL_API_KEY` | RetellProvider | ⏳ env נדרש |
| `RETELL_AGENT_ID` | RetellProvider | ⏳ env נדרש |
| `RETELL_FROM_NUMBER` | BYOC from_number | ⏳ env נדרש |
| `ORCHESTRATOR_URL` | web → POST /run | ⏳ env נדרש |
| `CALLER_ID` | caller ID לוגי | קיים ב-.env.example |

---

## Workflow יומי (מפעיל)

1. `/` — בחר תחום  
2. `/run/[id]` — הדבק / scrape 20  
3. "התחל חיוג" → `/monitor/[runId]`  
4. (עכשיו) "סמלץ שיחה" · (אחרי Plan 001) שיחות אמיתיות  
5. `/results/[id]` + ייצוא CSV  

---

## החלטות עיצוב (לא לשכוח)

1. **Interfaces** — `TelephonyProvider`, `LeadSource`, `Repo` → החלפות בלי לגעת ב-runController  
2. **ציות = config** — `DEFAULT_COMPLIANCE`; snapshot `ai_disclosed` per call  
3. **תוצאה = tool** — `record_outcome`, לא parse transcript  
4. **אין recordings** — transcript טקסט בלבד  
5. **Consent** — `consent_records` לכל lead ב-load  

---

## TODO מיידי (מתוך Plan 001)

- [ ] Twilio + Retell BYOC — לפי [`docs/TWILIO_RETELL_SETUP.md`](./docs/TWILIO_RETELL_SETUP.md)
- [x] `config.ts` — retell block
- [x] `telephonyFactory.ts` + `orchestratorApp.ts`
- [x] `server.ts` — POST `/run/:runId`
- [x] `run.ts` — trigger orchestrator after startRun + resume
- [x] Pause/Stop — sync דרך DB ב-runController
- [ ] smoke test — שיחה אמיתית אחת (אחרי BYOC)

---

## תבנית לרשומה חדשה (העתק)

```
### YYYY-MM-DD (יום)

| זמן | מה | איפה | למה |
|-----|-----|------|-----|
| HH:MM | תיאור קצר | path/file | סיבה בשורה |
```
