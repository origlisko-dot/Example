# Twilio ↔ Retell — Checklist להפעלת שיחה יוצאת (Plan 001 · שלב 1)

**תאריך:** 2026-07-12 (ראשון)  
**מטרה:** מספר Twilio יוצא דרך Elastic SIP Trunk → מיובא ל-Retell → `RETELL_FROM_NUMBER` בפרויקט.

> מדריך זה מבוסס על [Retell Twilio docs](https://docs.retellai.com/deploy/twilio) ו-[Outbound calls](https://docs.retellai.com/deploy/outbound-call).  
> סמן כל תיבה אחרי שביצעת. אם נתקעת — שלח צילום מסך של השלב + הודעת שגיאה.

---

## מה אתה צריך מראש

| פריט | איפה |
|------|------|
| חשבון Twilio (paid / trial עם יכולת PSTN) | [console.twilio.com](https://console.twilio.com) |
| חשבון Retell + Agent עברי ("בוט מכירות - פה לאוזן") | [Retell Dashboard](https://dashboard.retellai.com) |
| API Key של Retell | Retell → API Keys |
| Agent ID | Retell → Agents → העתק `agent_…` |
| מספר טלפון (Twilio) | רצוי `+972` אם זמין; אחרת US/EU + geo permissions לישראל |

**חשוב לישראל:** גם אם `from_number` הוא אמריקאי, חובה לאפשר חיוג ל-Israel ב-Twilio Geographic Permissions (ראה שלב D).

---

## A. Twilio — Elastic SIP Trunk

### A1. יצירת Trunk
- [ ] Twilio Console → **Elastic SIP Trunking** → **Trunks** → **Create new Trunk**
- [ ] שם: `pelozen-retell` (או דומה)
- [ ] שמור

### A2. Termination (= יוצא / Outbound) — הקריטי ביותר
- [ ] בתוך ה-Trunk → **Termination**
- [ ] צור **Termination SIP URI** (למשל `pelozen-retell.pstn.twilio.com`)
  - בלי רווחים
  - עדיף **localized URI** קרוב לאזור (ראה Localized URIs בקונסול)
- [ ] העתק את ה-URI למקום בטוח → זה מה שתזין ב-Retell

**אימות — בחר אחת:**

#### אופציה 1 (מומלצת): IP ACL
- [ ] Termination → Authentication → **IP Access Control Lists** → Create
- [ ] הוסף CIDR של Retell: **`18.98.16.120/30`**
  - (אם outbound נכשל עם 403 — ודא שגם ה-IP הספציפי `18.98.16.120` ברשימה; ראה [community note](https://community.retellai.com/t/enable-outbound-calling-custom-telephony-twilio-sip-trunk/2525))
- [ ] קשר את ה-ACL ל-Trunk

#### אופציה 2: Credential List
- [ ] Termination → **Credential Lists** → Create
- [ ] Username + Password (זכור: **username ≠ friendly name**)
- [ ] קשר ל-Trunk
- [ ] אותם credentials ייכנסו ל-Retell בזמן Import

### A3. Origination (= נכנס / Inbound) — אופציונלי אם אין שיחות נכנסות
- [ ] Origination → SIP URI: **`sip:sip.retellai.com`**
- [ ] Priority/Weight: ברירת מחדל
- [ ] Transport: TCP מומלץ (`sip:sip.retellai.com;transport=tcp` אם נדרש)

### A4. שיוך מספר ל-Trunk
- [ ] קנה מספר / השתמש במספר קיים
- [ ] **Phone Numbers** → המספר → קשר ל-**Elastic SIP Trunk** `pelozen-retell`
- [ ] העתק את המספר ב-E.164: `+972…` או `+1…` → זה יהיה `RETELL_FROM_NUMBER`

---

## B. Twilio — הרשאות גיאוגרפיות (חובה לישראל)

בלי זה: trunk עובד, אבל חיוג ל-`+972` נחסם.

- [ ] Twilio Console → חפש **"Voice Geographic Permissions"**
- [ ] בחר scope: **Elastic SIP Trunking**
- [ ] הפעל **Israel** (וגם מדינות יעד נוספות אם צריך)
- [ ] שמור (שינויים יכולים לקחת כמה דקות)

---

## C. Retell — Import מספר

- [ ] Retell Dashboard → **Phone Numbers** → **Import** / Connect Twilio
- [ ] הזן:
  - Phone number (E.164)
  - **Termination SIP URI** (משלב A2)
  - Username/Password — רק אם בחרת Credential List
- [ ] אחרי Import: המספר מופיע ברשימת המספרים ב-Retell

### C2. קשר Agent למספר
- [ ] בכרטיס המספר: הגדר **Outbound Agent** = הסוכן העברי שלך
- [ ] (אופציונלי) Inbound Agent — אפשר להשאיר ריק אם אין נכנסות
- [ ] Agent prompt: משתנה דינמי `{{system_prompt}}` (כמו בקוד שלנו)

### C3. Post-Call Analysis (מומלץ)
- [ ] Agent → Post-Call Analysis / Custom analysis fields
- [ ] שדות מינימום שיתאימו ל-`outcomeSchema`:
  - `interested` (bool)
  - `wants_callback` (bool)
  - `disposition` (enum: qualified_for_human / interested / callback_later / not_relevant / opted_out / wrong_number)
  - `notes` (string, אופציונלי)

---

## D. בדיקת Smoke ב-Retell (לפני הפרויקט)

- [ ] Retell Dashboard → Phone Numbers → המספר → **Make a test call**
- [ ] חייג למספר **שלך** (נייד אישי)
- [ ] ודא: צלצול → מענה → הדיבור בעברית/קול Cartesia
- [ ] ב-Call History: status `ended`, יש transcript

**אם outbound נכשל:**
| תסמין | בדיקה |
|--------|--------|
| 403 / permission denied | IP ACL / credentials ב-Termination |
| אין צלצול ל-IL | Geographic Permissions → Israel |
| מספר לא מזוהה | Import מחדש; URI בלי רווחים; localized URI |
| inbound עובד, outbound לא | כמעט תמיד Termination / ACL ([community](https://community.retellai.com/t/enable-outbound-calling-custom-telephony-twilio-sip-trunk/2525)) |

---

## E. חיבור לפרויקט Pelozen Caller

הוסף ל-`.env` בשורש המונורפו (וב-VPS של orchestrator):

```env
RETELL_API_KEY=key_...
RETELL_AGENT_ID=agent_...
RETELL_FROM_NUMBER=+972XXXXXXXXX   # בדיוק המספר שמיובא ב-Retell
CALLER_ID=+972XXXXXXXXX            # יכול להיות זהה
ORCHESTRATOR_URL=http://localhost:8080
NEXT_PUBLIC_ORCHESTRATOR_URL=http://localhost:8080

# כבר קיימים:
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
PHONE_HASH_SECRET=...
```

- [ ] הרץ orchestrator: `npm run dev:orchestrator`
- [ ] בדוק: `curl http://localhost:8080/health`
  - מצפה: `{ "ok": true, "retell": true, "telephony": "voip_sip" }`
- [ ] אם `retell: false` — חסר אחד מ-`RETELL_API_KEY` / `AGENT_ID` / `FROM_NUMBER`

### E2. שיחה ראשונה דרך הפאנל
- [ ] `npm run dev:web`
- [ ] בחר תחום → טען **1** מספר (הנייד שלך) → התחל חיוג
- [ ] **אל** תלחץ "סמלץ שיחה" — תן ל-orchestrator לחייג
- [ ] Monitor: attempt עובר מ-queued → completed
- [ ] Results: disposition + transcript ב-DB

---

## F. ערכים להעתיק אליי (כשנתקעים / לאימות)

מלא והדבק בצ'אט (בלי סיסמאות מלאות):

```
Termination URI: ________________.pstn.twilio.com
From number:     +_______________
Auth:            [ ] IP ACL 18.98.16.120/30   [ ] Credential List
Agent ID:        agent________________
Geo Israel:      [ ] ON
Retell import:   [ ] done
Test call:       [ ] OK / [ ] FAIL — error: ________
Health:          retell=____ telephony=____
```

---

## תרשים זרימה

```
Pelozen web "התחל חיוג"
        │
        ▼
orchestrator POST /run/:id
        │
        ▼
RetellProvider → create-phone-call
        │  from_number = RETELL_FROM_NUMBER
        │  override_agent_id = RETELL_AGENT_ID
        ▼
Retell SIP → Twilio Termination URI
        │
        ▼
PSTN → ליד (+972…)
```

---

## מקורות

- [Retell — Twilio Elastic SIP](https://docs.retellai.com/deploy/twilio)
- [Retell — Custom telephony](https://docs.retellai.com/deploy/custom-telephony)
- [Retell — Outbound calls](https://docs.retellai.com/deploy/outbound-call)
- [Community — outbound 403 / ACL](https://community.retellai.com/t/enable-outbound-calling-custom-telephony-twilio-sip-trunk/2525)
- [YouTube — Connect Twilio SIP to Retell](https://www.youtube.com/watch?v=JC3PV_R-Z1Y)
