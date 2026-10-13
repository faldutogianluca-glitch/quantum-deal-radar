---
name: "li-dm"
description: "Write LinkedIn connection notes and DM follow-ups that get replies: the 200-character invite, the first message, and two follow-ups. Use for 'connection request', 'DM this person', 'LinkedIn outreach', 'how do I follow up'."
---

# li-dm

(Source: github.com/Jakeschincariol/linkedin-agent-skill, MIT.) The invite note is 200 characters. The first DM decides whether there is a second one. Neither is a pitch.

## Before writing, get the specifics

Ask for, in one batched question:

1. **Who** - name, role, company.
2. **The hook** - the actual reason to reach out now. A post they wrote, a thing their company shipped, a mutual connection, a talk they gave. Not "they fit my ICP".
3. **What the user wants** - a conversation, a referral, a job, a sale. Be honest internally, even if the message does not lead with it.

If there is no specific reason to message this person today, say so.

## The invite note (200 characters)

```
{one specific reference to them} + {one line of who you are} + {no ask}
```

The note asks for nothing. Under 200 characters including spaces - count them and show the count.

```
Saw your post on killing the discovery call - we did the same thing in March
and it worked. I run ops at a 12-person studio. Would like to follow along.
                                                                    [187/200]
```

## The first message, after they accept

Wait a day. Then:

- **Two to four sentences.** A screen of text is a delete.
- **Reference the specific thing** from the note.
- **Give something before asking.** A number, a template, a name, an answer.
- **One ask, and make it small.** "Worth a 15-minute call?" beats "let me walk you through our platform".
- **No calendar link in message one.**

## Follow-ups

Two. That is the number.

- **+4 days** - add something new. Never "just bumping this". If you have nothing new, you have no follow-up.
- **+10 days** - the close-the-loop message. Say you will stop, and mean it.

Then stop.

## Never

- Never send an automated connection or message sequence. Automated outreach tools violate LinkedIn's User Agreement and get accounts restricted.
- Never fabricate a mutual connection, a shared school, or having read something the user has not read.
- Never open with "I hope this message finds you well".
- Never more than 20 invites a day.

## Output

The invite note with its character count, the first message, and both follow-ups with the day they go out. All humanized through li-human. The user sends every one of them by hand.

## Quantum Re context

When the user is Pitágora / Quantum Re and the target is a real-estate agent, NPL/UTP servicer, asset manager or SGR, the qre-partner-outreach skill owns the message strategy and compliance rules; use li-dm only for the LinkedIn format (200-char note, 2-4 sentence DM, two follow-ups) and the humanizer pass.