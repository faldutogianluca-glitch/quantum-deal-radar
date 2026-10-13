---
name: "li-human"
description: "Strip the machine fingerprint from a draft (em dashes, slop words, invisible characters) and score it on a five-check panel. Use for 'humanize', 'does this sound like AI', 'de-slop this', or before any LinkedIn post, comment or DM is shown."
---

# li-human

(Source: github.com/Jakeschincariol/linkedin-agent-skill, MIT.) Two tools ship with this skill and they both actually run. Use them. Do not eyeball this.

## Setup (once per session)

Fetch the scripts pinned to a reviewed commit. Standard library only, no network calls at runtime.

```bash
if [ ! -f /tmp/li-human/repo/skills/li-human/detect.py ]; then
  rm -rf /tmp/li-human && git init -q /tmp/li-human/repo && cd /tmp/li-human/repo \
  && git fetch -q --depth 1 https://github.com/Jakeschincariol/linkedin-agent-skill.git add2c23882fe79180737d242ff80a5da205eda6a \
  && git checkout -q FETCH_HEAD
fi
H=/tmp/li-human/repo/skills/li-human
```

Always pin to that commit hash; never fetch a moving branch.

```bash
python3 -I $H/humanize.py draft.txt -o clean.txt --report   # clean it, show what changed
python3 -I $H/detect.py draft.txt                           # score it, five checks
python3 -I $H/detect.py draft.txt clean.txt                 # prove the delta
```

Both read `slop.json` (in the same folder): 100+ stock words and phrases with plain replacements, 17 invisible character classes, typographic substitutions, 11 structural tells.

## What gets fixed automatically

1. **Invisible characters.** Zero-width spaces and joiners, word joiners, soft hyphens, BOMs, Unicode tag characters, non-breaking and narrow spaces, plus any other Unicode format character.
2. **Typography.** Em dash to comma, en dash to hyphen, curly quotes to straight, ellipsis to three dots, bullet character to hyphen.
3. **The slop lexicon.** delve, leverage, robust, seamless, crucial, tapestry, testament to, moreover, "in today's fast-paced world" and the rest, swapped for plain words, capitalisation preserved, URLs untouched.

## What does NOT get fixed automatically

Structural tells get **flagged, not rewritten**, because changing a sentence's shape needs judgement:

- "It's not just X, it's Y" and "not only X but also Y"
- Rule-of-three triads
- Rhetorical one-word question lines: "The result?"
- Rocket, fire, bulb, sparkle and dart emoji
- Hashtag walls
- Reflex engagement bait: "Thoughts?", "Agree?", "Who else?"
- Uniform sentence length and uniform bullet length

Rewrite each flagged line by hand, keeping the meaning, then re-run `detect.py`.

## The five checks

Scored 0-100, higher is more human: BURSTINESS (sentence-length variation), SPECIFICITY (numbers, names per 100 words), SLOP DENSITY (lexicon hits per 100 words), FINGERPRINT (invisible chars, em dashes, curly quotes per 1k chars), VOICE (contractions, person, structural tells). Verdict = 60% mean + 40% weakest check. PASS needs 70+ overall with no check below 55.

**Language note:** the lexicon, contraction and pronoun checks are English-only. On Italian text the invisible-character and typography passes work fully; treat SLOP DENSITY, VOICE and SPECIFICITY as indicative only, and do the Italian de-slop by judgement (e.g. "in un mondo in continua evoluzione", "fondamentale", "sinergia", "a 360 gradi", "game changer").

## Say this honestly

These are five local heuristics modelled on the signals public detectors key on. They are **not** GPTZero, Originality, Copyleaks, Winston or Turnitin and cannot promise those verdicts. Never tell a user their text is undetectable.

## Order of operations

1. Write the draft to a file; `humanize.py draft.txt -o clean.txt --report`.
2. Read the structural flags. Rewrite those lines yourself.
3. `detect.py draft.txt clean.txt` to show before and after.
4. If not PASS, fix the weakest check and go again. Two rounds is normal. Five means the draft was written by formula: write a different draft.
5. Show the user the cleaned text and the score. Never the score alone.