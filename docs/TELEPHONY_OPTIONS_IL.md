# אפשרויות טלפוניה — מספר ישראלי (+972)

**תאריך:** 2026-07-12 (ראשון)  
**הקשר:** Plan 001 — חלופות ל-Twilio BYOC כשהמטרה היא **המספר הישראלי שלך** כ-caller ID.

---

## מה אתה צריך (בכל אפשרות)

| דרישה | למה |
|--------|-----|
| `from_number` ב-E.164 (`+9725…`) | Retell + `RetellProvider` |
| SIP trunk / BYOC ל-Retell | [Custom telephony](https://docs.retellai.com/deploy/custom-telephony) |
| הרשאת חיוג ל-IL | Retell: `outbound_allowed_countries: ["IL"]` + ספק עם termination לישראל |
| Post-Call Analysis | שדות `interested`, `wants_callback`, `disposition` |

---

## השוואה מהירה

| # | אפשרות | מספר ישראלי | מורכבות | עלות חודשית (בערך) | מתאים אם… |
|---|--------|-------------|---------|---------------------|-----------|
| **1** | **Twilio IL + Retell** | קנייה/Port ב-Twilio | בינונית | $6–15 מספר + דקות | רוצה BYOC עם docs מלאים |
| **2** | **Telnyx IL + Retell** | קנייה/Port ב-Telnyx | בינונית | ~$1+ מספר + דקות | רוצה מספר IL זול + Retell רשמי |
| **3** | **ספק SIP ישראלי + Retell** | DID מקומי / קיים | גבוהה | משתנה (AstraQom, DIDWW…) | יש כבר קו עסקי / VoIP בישראל |
| **4** | **GSM Gateway + הסים שלך** | **הסים הקיים** | גבוהה (חומרה) | ~$11 סים + ~$15 VPS + gateway | חייב את **אותו** מספר נייד |
| **5** | **Twilio US + Verified Caller ID IL** | רק תצוגה (לא trunk IL) | נמוכה | US number + verify | פתרון זמני / לא מומלץ ל-production |

---

## 1. Twilio — מספר ישראלי (+972)

Twilio **מוכר** מספרים בישראל ([Voice Guidelines IL](https://www.twilio.com/en-us/guidelines/il/israel--voice-guidelines---twilio), [Pricing IL](https://www.twilio.com/en-us/voice/pricing/il)) — local/mobile מ-~$5.50/חודש.

**Flow:** Twilio IL number → Elastic SIP Trunk → Import ל-Retell → `RETELL_FROM_NUMBER=+972…`

| יתרון | חיסרון |
|--------|--------|
| מדריך מלא: [`docs/TWILIO_RETELL_SETUP.md`](./TWILIO_RETELL_SETUP.md) | Port מספר קיים ל-Twilio — לא תמיד trivial |
| הקוד שלנו מוכן | Geographic Permissions → Israel חובה |
| IL→IL caller ID אמיתי | עלות גבוהה יותר מ-Telnyx |

**Port:** אם יש לך מספר עסקי/קו — בדוק ב-Twilio Console → Port number.

---

## 2. Telnyx — מספר ישראלי (+972)

Telnyx מציע [Israel phone numbers](https://telnyx.com/phone-numbers/israel) מ-~$1/חודש. Retell תומך ב-[Telnyx SIP](https://docs.retellai.com/deploy/telnyx) (דומה ל-Twilio).

**Flow:** Telnyx IL DID → SIP Connection → Import ל-Retell (custom) + Termination URI

| יתרון | חיסרון |
|--------|--------|
| מספר IL זול | פחות community posts בעברית |
| CPS עד 16 (Retell docs) | setup דומה ל-Twilio — IP whitelist `18.98.16.120/30` |
| Retell רשmi | |

**Checklist (מקביל ל-Twilio):**
- [ ] Telnyx → Buy/Port `+972` number
- [ ] SIP Connection → Outbound voice profile → Israel enabled
- [ ] Retell → Import number + termination URI + credentials
- [ ] `outbound_allowed_countries: ["IL"]` ב-import API
- [ ] `.env` — אותם `RETELL_*`, `FROM_NUMBER=+972…`

---

## 3. ספק SIP ישראלי (מקומי) → Retell BYOC

אם יש לך **קו עסקי / מרכזיה / VoIP ישראלי** (Bezeq International, AstraQom, DIDWW, ספקי 3CX):

**Flow:** ספק IL → SIP trunk credentials → Retell Import (phone_number_type: `custom`)

ספקים שנבדקו עם 3CX בישראל: [3CX Israel SIP list](https://www.3cx.com/partners/sip-trunks/israel/)

| יתרון | חיסרון |
|--------|--------|
| מספר ישראלי "אמיתי" מקומי | פחות documentation מול Retell |
| לפעמים כבר יש לך את המספר | תמיכה = אתה + ספק + Retell |
| DIDWW: [IL SIP trunking](https://www.didww.com/voice/global-sip-trunking/Israel) | צריך SIP URI + auth נכון |

**Retell:** כל ספק עם Elastic SIP / termination URI — [Custom telephony](https://docs.retellai.com/deploy/custom-telephony). Whitelist IP: `18.98.16.120/30`.

---

## 4. GSM Gateway + הסים הישראלי שלך (הארכיטקטורה המקורית)

זו האפשרות **היחידה** שמשתמשת **פיזית** ב-SIM שכבר יש לך (054/050…) בלי Port.

```
[SIM שלך] → GSM Gateway (OpenVox/Dinstar) → SIP → ??? → Retell/Pipecat
```

### 4a. GSM → Retell (מורכב)
- Gateway כ-SIP endpoint
- צריך **גשר** שמחבר את ה-gateway ל-Retell (SIP trunk דו-כיווני)
- Retell מצפה ל-BYOC trunk — לא כל gateway "יושב" ישירות
- **לא מומלץ** כשלב ראשון

### 4b. GSM → Pipecat (קיים בקוד) ✅
- `AsteriskGsmProvider` + `pipeline/agent.py`
- Gateway + Asterisk ARI → Pipecat (Deepgram + LLM + Cartesia)
- **Caller ID = הסים שלך** — מובטח
- **חיסרון:** לא Retell — צריך להשלים transport (build-day בקוד)

| יתרון | חיסרון |
|--------|--------|
| המספר **שלך** בלי Port | חומרה ~$80–150 (OpenVox 1-port) |
| תעריף סים שטוח | `AsteriskGsmProvider` עדיין stub |
| README תכנן את זה | self-hosted voice pipeline |

**מתי לבחור:** יש לך סים פעיל + לא רוצה/לא יכול Port → GSM + Pipecat.

---

## 5. Verified Caller ID (לא מספר IL אמיתי ב-trunk)

Twilio מאפשר [Verified Caller ID](https://docs.retellai.com/deploy/twilio) — להציג `+972` על שיחה שיוצאת מ-trunk US.

| יתרון | חיסרון |
|--------|--------|
| מהיר לבדיקה | לא תמיד עובר בישראל (carriers חוסמים) |
| לא צריך IL DID | **לא** מתאים ל-production / compliance |
| | Retell+Twilio IL geo עדיין נדרש ליעד +972 |

---

## המלצה לפי מצב

| המצב שלך | המלצה |
|----------|--------|
| **אין מספר IL ביד, רוצה הכי מהיר עם Retell** | **Telnyx IL** או **Twilio IL** + מדריך BYOC |
| **יש מספר IL עסקי / VoIP** | **ספק SIP ישראלי** → Retell custom import |
| **חייב את הסים הנייד הקיים (054…)** | **GSM Gateway + Pipecat** (Plan 001b) |
| **רק לבדוק שהכל עובד** | Twilio IL test + 1 lead, אחרי smoke — החלט |

---

## מה לא משתנה בקוד (בכל אפשרות Retell)

```env
RETELL_FROM_NUMBER=+972XXXXXXXXX   # המספר שיובא ל-Retell
RETELL_AGENT_ID=agent_...
RETELL_API_KEY=key_...
```

`RetellProvider` שולח `from_number` ב-`create-phone-call` — [Outbound docs](https://docs.retellai.com/deploy/outbound-call).

---

## Plan 001b (עתידי) — GSM + Pipecat

אם תבחר בסים:
1. קנה OpenVox/Dinstar 1-port
2. השלם `AsteriskGsmProvider.dial` + `pipeline/agent.py` transport
3. `buildOrchestrator()` → switch ל-GSM כש-`SIP_GATEWAY_HOST` מוגדר בלי Retell

---

## מקורות

- [Retell — Twilio](https://docs.retellai.com/deploy/twilio)
- [Retell — Custom telephony](https://docs.retellai.com/deploy/custom-telephony)
- [Retell — Outbound calls](https://docs.retellai.com/deploy/outbound-call)
- [Retell community — Israel +972](https://community.retellai.com/t/enable-israel-972-for-outbound-calls-on-my-account/781)
- [Telnyx Israel numbers](https://telnyx.com/phone-numbers/israel)
- [Twilio Israel guidelines](https://www.twilio.com/en-us/guidelines/il/israel--voice-guidelines---twilio)
- [3CX Israel SIP providers](https://www.3cx.com/partners/sip-trunks/israel/)
