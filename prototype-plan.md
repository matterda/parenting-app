# Parenting Assistant — Two-Week Solo Prototype Plan

> Purpose of this document: a hard-scoped plan to build the *smallest thing that tests whether the core bet is real*, living with it for ~2–3 weeks on a real baby, and producing an artifact good enough to (a) give you conviction or a clean no, and (b) demo to early users and investors later. This is a learning instrument, not a v1.

---

## 1. What this prototype is actually testing

The technology is mostly known to work. The open questions are about **value and behavior**, so the prototype must attack these in order of how badly they could kill the idea:

1. **Friction.** Does natural-language logging genuinely feel lower-effort than tapping, in real daily use, including at 3am one-handed? (This is the central bet. If it loses here, the premise is wrong.)
2. **Trust in extraction.** Does the "parse → echo back interpretation → one-tap fix" loop feel reassuring, or annoying? Are errors rare enough not to poison trust?
3. **Synthesis quality.** Is the one-page pediatrician report actually good — would a real pediatrician find it useful, would *you* trust it?
4. **The anxiety philosophy.** Living with it, does the app *reduce* cognitive load and reassure, or does it quietly manufacture a surveillance treadmill? (Hardest to measure, most important to your differentiation.)

If after the test you find yourself **reaching for this instead of a structured logger**, that's a stronger signal than any amount of reasoning. If you don't reach for it, that's the cheapest "no" you'll ever buy.

---

## 2. Explicit non-goals (the discipline that makes this work)

The seductive failure mode is building the *impressive* parts because they demo well. They are not your risky assumptions — you already know they work. **Do not build, in this phase:**

- Voice cloning / synthetic soothing
- Cry classification
- Generative photo artifacts / time-lapse
- Sleep-window prediction (needs weeks of data before it's meaningful — wrong thing to test first)
- Multi-user auth, real sharing, permission scopes (simulate sharing by *showing yourself* the digest view)
- Native app store builds, push notifications, watch/Alexa integrations
- Polished onboarding, settings, accounts

You will be tempted by every one of these. The prototype that nails the cry-classifier but never tested talk-vs-tap has optimized the wrong thing.

The **one** piece worth polishing beyond "rough" is the **report generator**, because it's your sharpest differentiator and your best demo artifact.

---

## 3. Tech stack — optimized for zero friction on a laptop, Android delivery

**Recommendation: a web-first PWA. No native build, no Android Studio, no emulator, no app store.**

Develop entirely in your laptop browser; when you want the real 3am test, open it on your Android phone and "Add to Home Screen" — it behaves like an app (full screen, icon, offline shell).

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (React)** | One framework for UI + a server API route. Server route keeps your LLM API key off the client. |
| Styling | **Tailwind CSS** | Fast, no design system needed for a prototype. |
| Storage | **Supabase (free Postgres)** | Hosted, zero-ops, gives you persistence now and an auth/multi-user path later if it graduates. Single hardcoded user for the prototype. |
| LLM | **Anthropic API (Claude)** for extraction + report synthesis | Strong at structured extraction and summarization, which is the entire job here. |
| Deploy | **Vercel free tier** | `git push` → live URL in seconds. The live URL is what you load on the phone. |

**The single biggest friction-reducer — do not build voice recognition.** Use a plain text input. On Android, dictate into it with the **keyboard's built-in microphone (Gboard dictation)**. This tests the real hypothesis (NL → structured data) and completely sidesteps the Web Speech API rabbit hole. You get "speak to log" for free.

**Alternative if you want a more native feel / more reliable voice later:** Expo (React Native) + Expo Go — scan a QR code and it runs on your Android phone with hot reload, no build pipeline. Slightly more setup than a PWA; only worth it if the PWA's feel disappoints you. **Start with the PWA.**

---

## 4. Event schema (keep it tight — extract to this shape)

```json
{
  "type": "feed | sleep | diaper | weight | temperature | medication | note | milestone",
  "timestamp_start": "ISO 8601",
  "timestamp_end": "ISO 8601 | null",
  "data": {
    // feed:        { method: "breast|bottle", side: "L|R|null", volume_ml: number|null, duration_min: number|null }
    // sleep:       { } (uses start/end)
    // diaper:      { kind: "wet|dirty|both" }
    // weight:      { value: number, unit: "kg|g|lb|oz" }
    // temperature: { value: number, unit: "C|F" }
    // medication:  { name: string, dose: string|null }  // includes vaccines
    // milestone:   { label: string }
    // note:        { } (the free text is the value)
  },
  "raw_text": "the original phrase this came from",
  "context_note": "any rich qualitative detail, e.g. 'fussy and warm after vaccine'",
  "confidence": "high | low",
  "needs_confirmation": ["volume", "timestamp"]  // fields the user should verify
}
```

A single utterance can yield **multiple** events ("changed her, fed 120, she's asleep now" → diaper + feed + sleep). The `context_note` field is deliberately first-class — capturing the qualitative long-tail that structured loggers throw away is a core part of your edge.

---

## 5. The extraction prompt (the heart of it)

System prompt for the extraction call. Pass it the user text, the **current local datetime + timezone**, and minimal baby context (name, date of birth).

```
You convert a parent's free-text or dictated note about their baby into structured log events.

CONTEXT YOU RECEIVE:
- current_datetime (ISO, with timezone)
- baby: { name, date_of_birth }
- the parent's raw note

YOUR JOB:
1. Extract every loggable event into the schema below. One note may contain several.
2. Resolve relative and vague times against current_datetime ("an hour ago", "at 3",
   "last night", "this morning"). When a time is genuinely ambiguous (am vs pm, today vs
   yesterday, a bare number), pick the most likely reading AND add the field to
   needs_confirmation. Never silently guess on times — flag them.
3. Preserve qualitative detail in context_note verbatim-ish (e.g. "seemed in pain",
   "warm to the touch", "refused the bottle"). This detail is valuable; do not discard it.
4. Set confidence:"low" and populate needs_confirmation for any numeric value or time you
   are not sure about. A misread volume (120 -> 12) corrupts every downstream trend, so be
   conservative.

HARD RULES:
- You DESCRIBE and ORGANIZE the parent's data. You do NOT interpret, diagnose, advise, or
  flag anything as concerning or normal. No medical judgment of any kind.
- If the note asks a health/advice question ("is this rash dangerous?", "is this normal?"),
  do NOT answer it. Instead return it as a note of type "question_for_pediatrician" so it
  flows into the doctor report. Set a flag advice_requested:true so the app can show the
  safe redirect.
- Output ONLY valid JSON matching the schema. No prose, no markdown, no backticks.

SCHEMA:
{ "events": [ <event objects per the schema> ], "advice_requested": boolean }
```

**The echo loop (the trust mechanic):** after extraction, render each event back as a plain-English line —
> *"Got it: **fed 120ml from a bottle** at **3:05am** (tap to fix the time or amount)."*
Fields in `needs_confirmation` get a subtle highlight. One tap opens an inline edit. This slightly punctures the "zero friction" dream — accept that. Errors in baby data are trust-poisoning; a 2-second confirm is cheaper than a corrupted report.

**The advice redirect (turn the refusal into a feature):** when `advice_requested` is true, never flatly refuse. Show:
> *"I can't assess that — but I've saved your question for your pediatrician, and here's a summary of the last 3 days you can show them."*
This converts the anxiety into the thing you *can* safely do. Handled well it's a feature, not an apology.

---

## 6. Trend view (rough is fine)

A single scrollable screen. Descriptive only — **no flagging of concern, no editorializing about which trends matter.**

- Today at a glance: last feed, last sleep, last diaper, counts so far today.
- A simple 7-day view per category (feeds/day, total sleep, diapers/day) — sparklines or bare bars.
- A reverse-chronological event log with the `context_note`s visible.

Discipline reminder: *the act of surfacing* a trend is a soft clinical judgment. The trend view is safe because it describes the parent's own data and hands interpretation to the report → the pediatrician. Keep it neutral.

---

## 7. The one-page pediatrician report (polish this one)

This is your differentiator and your demo artifact. **One page. A synthesis, not a data dump** — a 30-page log export is negative value to a time-pressured doctor. Generate it with a second LLM call over the structured events for a chosen window (e.g. last 7/14 days).

Contents:
1. **Header** — baby name, age, period covered.
2. **Summary** — feeds, sleep, diapers as plain ranges/averages over the period.
3. **What changed** — descriptive deltas vs the prior period ("feeds down ~20%, sleep more fragmented in the last 5 days"). Descriptive, never "concerning."
4. **Notable context** — the qualitative notes clustered ("3 mentions of fussiness after evening feeds").
5. **Parent's questions** — the saved `question_for_pediatrician` items, verbatim.

Report-generation prompt rules: *Summarize and prioritize the parent's logged data for a clinician. Be concise enough to read in under a minute. State facts and changes; do NOT interpret, diagnose, or label anything normal/abnormal/concerning. The clinician interprets.*

Output as clean HTML you can print-to-PDF (a parent emails it or brings it in). **Do not build a clinician-facing portal** — pediatricians won't onboard to your app in this phase.

---

## 8. Two-week build sequence

**Days 1–2 — skeleton & plumbing.** Next.js + Tailwind on Vercel, Supabase connected, the event schema as a table, a text input that posts to a server API route, hardcoded single user. Goal: text in → row in DB.

**Days 3–5 — extraction + echo loop.** Wire the extraction prompt. Render parsed events back as plain-English confirm lines with inline one-tap edit and the `needs_confirmation` highlighting. This is the riskiest mechanic — get it feeling good. Test the relative-time handling hard.

**Days 6–7 — start living with it.** Begin real daily use now, even though it's ugly. Real usage from day 6, not day 14, is the whole point. Keep a running note of every friction moment.

**Days 8–9 — trend view.** The single descriptive screen. Just enough to see your own accumulating data.

**Days 10–12 — the report.** The second LLM call and the one-page HTML/PDF. Iterate on it until *you'd* trust it. If you know a pediatrician, show them a sample this week.

**Days 13–14 — the advice redirect + rough edges.** The graceful "I can't advise, here's what I can do" pattern. PWA manifest so it installs cleanly on the phone. Fix only what blocks daily use.

Throughout: dictate via the Android keyboard mic to test the "speak to log" experience for free.

---

## 9. Decision criteria — what tells you go / no-go

**Green (build conviction, consider widening):**
- You reach for it over a structured logger without forcing yourself.
- The echo loop feels reassuring; extraction errors are rare and caught.
- The report is something you'd actually hand a doctor; a real pediatrician reacts well.
- Across 2–3 weeks it felt like *less* mental load, not a new chore.

**Red (cheap, valuable no — or pivot):**
- You keep reverting to tapping/another app because talking is slower for the common events. *(If so, the lesson is likely "NL for the tail, taps for the head" — a hybrid, not a death.)*
- Extraction errors are frequent enough that you stop trusting the data.
- The report reads as generic filler a CSV could produce.
- Using it made you *more* anxious, not less.

---

## 10. Designing the solo phase to be fundable later

The prototype proves *feasibility*. Investors will probe *desire* — and desire is the scarce thing. So make one non-build goal explicit from the start:

- **Get ~5 other parents using it** before you pitch. "I built this and used it on my own kid for a month" is a good founder story; "and five other parents won't stop using it" is the part that raises money.
- Keep a crisp written **moat thesis**: NL-native vs retrofitted schemas, superior report synthesis, trust/privacy-first brand, and multi-caregiver coordination as a first-class citizen — the things incumbents (Huckleberry, Glow) find hardest to copy because they're *positioning and network*, not tech.
- Note the privacy posture as a deliberate choice even in the prototype (on-device where feasible, no training on user data, real deletion). It's the brand, not a feature.

---

## 11. The one-line reminder to keep on your desk

> Build the **ugly, central, risky** thing first — friction-free logging and trustworthy synthesis — and live with it. Everything impressive can wait until you know someone other than you wants this.
