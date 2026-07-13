# מסלול 2 — GSM + הסים שלך (Pipecat)

**תאריך:** 2026-07-12 (ראשון)

## במשפט

קופסה קטנה + הסים שלך → Asterisk → הבוט מדבר → חיוג לליד.  
**אותו מספר** — בלי Port, בלי לקנות מספר חדש.

---

## התקנת Python (חובה לפני pipeline)

**אין צורך ב-Homebrew, Python 3.14, או sudo.**

ב-Linux / Cloud Agent יש כבר `python3` (3.12). הפקודה `python` לבד **לא** קיימת — זה תקין.

```bash
# פעם אחת — התקנת חבילות (בלי sudo)
npm run setup:pipeline

# בדיקה
python3 --version          # צריך 3.12+
npm run dev:pipeline       # שרת על :8090
curl http://127.0.0.1:8090/health
```

אם `python: not found` — השתמש ב-`python3`, לא `python`.  
אם `venv` נכשל — `npm run setup:pipeline` משתמש ב-`pip install --user` (עובד בלי sudo).

---

## שלב 0 — בדיקה בלי חומרה (SIM)

אפשר לבדוק את **כל המערכת** בלי קופסה:

```bash
# טרמינל 1
npm run dev:pipeline          # PIPELINE_MODE=sim

# טרמינל 2 — ב-.env:
TELEPHONY_MODE=gsm
PIPELINE_URL=http://127.0.0.1:8090

npm run dev:orchestrator
npm run dev:web
```

`curl http://localhost:8080/health` → `"mode":"gsm","telephonyReady":true`

"התחל חיוג" — שיחות מדומות (כמו סמלץ, אבל דרך pipeline אמיתי).

---

## שלב 1 — קניית קופסה (חד-פעמי)

| מוצר | מחיר בערך | הערה |
|------|-----------|------|
| OpenVox 1-port GSM | ~$80–120 | 1 סים |
| Dinstar 1-port | ~$100–150 | דומה |

חפש: **"GSM gateway 1 port SIP"**.

---

## שלב 2 — חיבור פיזי

1. הכנס **הסים שלך** לקופסה
2. חבר **Ethernet** לרשת
3. הגדר ב-web UI של הקופסה:
   - SIP Endpoint (username/password)
   - Outbound route: SIP → SIM

---

## שלב 3 — Asterisk (VPS)

Asterisk מחבר: `orchestrator → pipeline → Asterisk → קופסה → סים`

Env:

```env
TELEPHONY_MODE=gsm
PIPELINE_MODE=asterisk
PIPELINE_URL=http://127.0.0.1:8090
ASTERISK_ARI_URL=http://127.0.0.1:8088/ari
ASTERISK_ARI_USER=pelozen
ASTERISK_ARI_PASSWORD=...
GSM_GATEWAY_ENDPOINT=gsm
CALLER_ID=+972501234567
```

---

## שלב 4 — הרצה

```bash
npm run dev:pipeline    # port 8090
npm run dev:orchestrator
npm run dev:web
```

---

## מתג בין המסלולים

| רוצה | `.env` |
|------|--------|
| Port/Twilio → Retell | `TELEPHONY_MODE=retell` + `RETELL_*` |
| הסים שלך → GSM | `TELEPHONY_MODE=gsm` + `PIPELINE_*` |
| אוטומטי | `TELEPHONY_MODE=auto` (Retell אם מוגדר, אחרת GSM) |

---

## מה עדיין ב-build

- [ ] Pipecat audio bridge (Stasis → `agent.py`) — שיחה עם קול Cartesia דרך GSM
- [ ] Asterisk originate עובד; voice bridge = השלב הבא

ראה גם: [`TELEPHONY_OPTIONS_IL.md`](./TELEPHONY_OPTIONS_IL.md)
