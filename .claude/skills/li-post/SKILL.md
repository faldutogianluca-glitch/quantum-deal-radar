---
name: "li-post"
description: "Write a LinkedIn post from a raw idea using 21 hook formulas, in the user's own voice, humanized via li-human. Use for LinkedIn posts, hooks, 'post about X', 'turn this into a LinkedIn post'."
---

# li-post

Turns one raw idea into a LinkedIn post that sounds like the person who posted it. (Source: github.com/Jakeschincariol/linkedin-agent-skill, MIT.)

## Before you write

1. Read the voice profile if it exists (`~/.claude/linkedin/voice.md`, or a project doc named `linkedin-voice.md`). If it does not exist, ask for **three of their own past posts**, infer the voice from those, and write the file. Do not skip this and do not invent a voice. A post in the wrong voice is worse than no post.
2. Use the Hook library at the bottom of this file: 21 formulas with templates, examples, what each is for, and how each gets ruined.
3. If the idea is thin - "post about AI" - do not pad it. Ask one batched question: what happened, to whom, and what did it cost or return. A post needs one specific true thing. Get it before writing.

## The shape

LinkedIn rewards dwell time, saves and comments, in that order. So:

```
Line 1     the hook. Alone. It has to survive truncation at ~140 chars mobile.
Line 2     the payoff of line 1, not setup for line 3.
Body       short paragraphs, 1-3 lines each, blank line between every one.
           No wall. The white space is the format.
The turn   one line that reframes what came before.
Close      one specific question, or one instruction. Never both.
```

Length: 900-1,300 characters is the working range for a text post. Under 400 reads as a thought, not a post. Over 2,000 needs to earn every line, and the "see more" tap has to be paid for by line 2.

## The loop

**1. Pick three hooks, not one.** Run the idea through the Hook library and choose the three formulas that genuinely fit it. Different formulas, not three variations of one. Show them as three numbered lines and say which you would ship and why, in one sentence.

**2. Draft the full post** on the strongest hook.

**3. Humanize it.** Run the draft through the li-human skill before showing it. Every post from this skill ships humanized.

**4. Print the block.** Copy-ready, in a fenced block, exactly as it should be pasted. Then, underneath:

```
POST READY
hook:      #17 Time Anchor
length:    1,140 characters
humanizer: 6 artefacts stripped, human score 84 PASS
post at:   Tuesday 8:15

Reply "yes" to log it, or tell me what to change.
```

**5. Never publish.** This skill produces text. The user posts it. On "yes", append the post to `~/.claude/linkedin/log.md` (or a project doc `linkedin-log.md`) with the date, the hook used and the first line.

## Rules that make the difference

- **One idea per post.** If the draft has two, you have two posts. Say so.
- **Numbers over adjectives.** "$4,200" beats "a lot". If the user has not given you a number, ask for one rather than writing around the hole.
- **No engagement bait.** "Thoughts?" and "Agree?" are dead. The closing question has to be one only this post could ask.
- **Three hashtags maximum**, at the bottom, and only if they are real categories someone follows.
- **No links in the post body.** LinkedIn suppresses posts with outbound links. Put the link in the first comment and say so in the receipt.
- **Never fabricate.** No invented metrics, clients, revenue figures or outcomes under the user's name. If a number is needed and unknown, leave `{{your number}}` in the draft and flag it.

## Example

```
/li-post we built an internal tool that cut proposal time from 5 hours to 20 min
```

```
HOOKS
1. #17 Time Anchor    Writing a proposal used to take me 5 hours. It now takes 20 minutes.
2. #12 Comparison     A $12,000 proposal writer vs a weekend and a template. The weekend won.
3. #3  Mistake        For two years I charged clients for hours I was wasting on formatting.

Shipping #17: the ratio is believable and the number is yours.
```

## Hook library

The original 21 formulas (templates, examples, best-for and traps) live in `skills/li-post/hooks.json` of github.com/Jakeschincariol/linkedin-agent-skill (commit add2c23882fe79180737d242ff80a5da205eda6a). Before picking hooks, fetch and read that file if network access is available:

```bash
curl -sL https://raw.githubusercontent.com/Jakeschincariol/linkedin-agent-skill/add2c23882fe79180737d242ff80a5da205eda6a/skills/li-post/hooks.json
```

Hook rules (always apply):
- One idea per hook. If it needs a comma splice, it needs two posts.
- Line 2 is not a hook, it is the payoff of line 1. Never waste it on setup.
- No question marks in line 1 unless the question is specific enough that only you could ask it.
- Numbers beat adjectives.
- If the hook works with any other person's name on it, it is not your hook.