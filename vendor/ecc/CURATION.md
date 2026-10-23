# ECC curated copy

Source: https://github.com/affaan-m/ECC, v2.2.3, commit `90606c8315ee09cafc303515c5f33024db6b9882` (MIT, see `LICENSE`).
Only plugin runtime files are kept (`.claude-plugin`, `agents`, `commands`, `hooks`, `scripts`, `skills`, `manifests`, `schemas`, `config`).
Loaded via `.claude/settings.json` as `ecc@ecc-curated` (directory marketplace).

Claude Code `skillOverrides` cannot turn off individual plugin skills, so the
removals below are done on the files themselves.

## Removed: duplicates of skills already installed

| ECC skill | Already covered by |
|---|---|
| deep-research | anthropic-skills:deep-research |
| security-review | built-in /security-review |
| seo | marketing:seo-audit, small-business:seo-ai-visibility, openseo |
| google-workspace-ops | anthropic-skills:google-workspace |
| content-engine, article-writing | marketing:content-creation, marketing:draft-content, small-business:social-content-engine |
| brand-voice, brand-discovery | linkedin-humanizer --mode profile, small-business:brand-style, marketing:brand-review |
| marketing-campaign (skill + command) | marketing:campaign-plan |
| competitive-platform-analysis, competitive-report-structure | marketing:competitive-brief, sales:competitive-intelligence |
| lead-intelligence | sales:lead-triage, small-business:lead-finder |
| email-ops | small-business:inbox-manager, sales:inbox-sweep |
| crosspost, social-publisher | linkedin-repurposer, Metricool / Publora |
| frontend-slides | anthropic-skills:pptx |
| customer-billing-ops, finance-billing-ops | small-business:invoice-chase, QuickBooks |
| inventory-demand-planning | small-business:inventory-planner |
| jira-integration, jira (command) | Atlassian plugin |
| continuous-learning | ecc:continuous-learning-v2 (deprecated v1) |
| unified-memory, knowledge-ops | claude-mem, productivity:memory-management |
| code-review, review-pr (commands) | built-in /code-review |
| marketing-agent, seo-specialist (agents) | marketing plugin, openseo |

## Removed: off-stack packs (project is TypeScript/Node + Python)

Skills, agents and commands for Android, Angular, Compose, C++, C#, Dart/Flutter,
Django, .NET, F#, Go, Java/JPA/Spring Boot/Quarkus/MyBatis, Kotlin, Laravel/PHP,
Perl, Rails/Ruby, React Native, Rust, Swift/iOS, Vue/Nuxt, HarmonyOS, Windows desktop,
tinystruct, plus domain packs: homelab, networking (Cisco/BGP/Netmiko), healthcare/HIPAA,
scientific databases, Bengali NLP, Itô compute, Blender, supply chain/logistics,
prediction markets, crypto/DeFi/x402, visa translation, DeepSeek harness.

To restore something, copy the folder back from the upstream commit above.
