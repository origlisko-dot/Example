# Graph Report - NEW PROJECT  (2026-07-12)

## Corpus Check
- 67 files · ~34,801 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 452 nodes · 624 edges · 28 communities (21 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- createServerClient
- runController.ts
- devDependencies
- compilerOptions
- pelozenScraperSource.ts
- index.ts
- package.json
- Repo
- leadParse.ts
- Parser
- package.json
- compilerOptions
- package.json
- agent.py
- tsconfig.json
- FakeRepo
- tsconfig.json
- campaign.ts
- config.ts
- Pelozen Caller — בוט חיוג קולי בעברית בקול המשתמש
- pipeline/ — Hebrew voice agent (Pipecat)
- layout.tsx
- README.md
- next.config.ts
- AGENTS.md
- next-env.d.ts
- postcss.config.mjs

## God Nodes (most connected - your core abstractions)
1. `createServerClient()` - 22 edges
2. `compilerOptions` - 16 edges
3. `Repo` - 15 edges
4. `SupabaseRepo` - 14 edges
5. `PelozenScraperSource` - 12 edges
6. `compilerOptions` - 12 edges
7. `Parser` - 11 edges
8. `FakeRepo` - 11 edges
9. `TelephonyProvider` - 9 edges
10. `loadConfig()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `RunDeps` --references--> `Repo`  [EXTRACTED]
  orchestrator/src/orchestrator/runController.ts → orchestrator/src/db/repo.ts
- `EditCampaignPage()` --calls--> `createServerClient()`  [EXTRACTED]
  web/app/campaigns/[id]/edit/page.tsx → web/lib/supabase/server.ts
- `TopicPicker()` --calls--> `createServerClient()`  [EXTRACTED]
  web/app/page.tsx → web/lib/supabase/server.ts
- `ResultsPage()` --calls--> `createServerClient()`  [EXTRACTED]
  web/app/results/[campaignId]/page.tsx → web/lib/supabase/server.ts
- `RunPage()` --calls--> `createServerClient()`  [EXTRACTED]
  web/app/run/[topic]/page.tsx → web/lib/supabase/server.ts

## Import Cycles
- 2-file cycle: `orchestrator/src/leadSource/index.ts -> orchestrator/src/leadSource/pelozenScraperSource.ts -> orchestrator/src/leadSource/index.ts`

## Communities (28 total, 7 thin omitted)

### Community 0 - "createServerClient"
Cohesion: 0.08
Nodes (37): BatchPreview, ItemStatus, loadBatch(), PreviewItem, getRunSnapshot(), RunSnapshot, RunState, setRunState() (+29 more)

### Community 1 - "runController.ts"
Cohesion: 0.07
Nodes (25): CompiledPrompt, compilePrompt(), injectVariables(), LeadVariables, MASTER_TEMPLATE(), outcomeFieldToJsonSchema(), SAMPLE_CAMPAIGN, Clock (+17 more)

### Community 2 - "devDependencies"
Cohesion: 0.06
Nodes (31): next, react, react-dom, tailwindcss, @tailwindcss/postcss, @types/react, @types/react-dom, dependencies (+23 more)

### Community 3 - "compilerOptions"
Cohesion: 0.06
Nodes (30): ./*, dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts (+22 more)

### Community 4 - "pelozenScraperSource.ts"
Cohesion: 0.12
Nodes (13): CsvUploadSource, LeadSource, LoadResult, cleanName(), extractCards(), PelozenCredentials, PelozenScraperSource, ScrapedCard (+5 more)

### Community 5 - "index.ts"
Cohesion: 0.11
Nodes (21): CAMPAIGN_SCRIPTS, QType, ScriptDef, loadConfig(), OrchestratorConfig, required(), buildOrchestrator(), ingestLeads() (+13 more)

### Community 6 - "package.json"
Cohesion: 0.08
Nodes (24): dependencies, @pelozen/shared, playwright, @supabase/supabase-js, devDependencies, tsx, @types/node, typescript (+16 more)

### Community 8 - "leadParse.ts"
Cohesion: 0.19
Nodes (14): detectHeader(), isNameColumn(), isPhoneColumn(), parsePastedLeads(), ParseResult, splitRow(), InvalidPhoneError, isIsraeliMobile() (+6 more)

### Community 9 - "Parser"
Cohesion: 0.20
Nodes (7): classifyDisposition(), evalExpr(), OPS, Parser, Token, tokenize(), Value

### Community 10 - "package.json"
Cohesion: 0.12
Nodes (15): description, engines, node, name, private, scripts, build, dev:orchestrator (+7 more)

### Community 11 - "compilerOptions"
Cohesion: 0.13
Nodes (14): ES2022, compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+6 more)

### Community 12 - "package.json"
Cohesion: 0.13
Nodes (14): devDependencies, typescript, exports, ./compliance, typescript, main, name, private (+6 more)

### Community 13 - "agent.py"
Cohesion: 0.19
Nodes (12): build_llm(), load_call_context(), outcome_tool(), Pelozen voice agent — the live Hebrew conversation for ONE call.  Pipeline:  aud, POST the structured outcome + short transcript back to the orchestrator., The compiled prompt + tool schema + call metadata for THIS call., Pick the dialogue brain. Gemini Flash by default (cheapest capable Hebrew)., Turn the orchestrator's record_outcome JSON-schema into a Pipecat tool. (+4 more)

### Community 14 - "tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, outDir, rootDir, types, exclude, extends, include, src/**/*.test.ts (+3 more)

### Community 16 - "tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src/**/*.test.ts, src/**/*.ts (+1 more)

### Community 17 - "campaign.ts"
Cohesion: 0.22
Nodes (8): Campaign, Disposition, ObjectionHandler, OutcomeField, OutcomeFieldType, QualifyingQuestion, QuestionType, VoiceSettings

### Community 18 - "config.ts"
Cohesion: 0.29
Nodes (6): CallingWindow, ComplianceConfig, DEFAULT_COMPLIANCE, DisclosureConfig, isWithinCallingWindow(), zonedParts()

### Community 19 - "Pelozen Caller — בוט חיוג קולי בעברית בקול המשתמש"
Cohesion: 0.33
Nodes (5): Pelozen Caller — בוט חיוג קולי בעברית בקול המשתמש, ארכיטקטורה (DIY רזה, self-hosted), הקמה, מבנה המונורפו, עלות צפויה (קו אחד, רצף)

### Community 20 - "pipeline/ — Hebrew voice agent (Pipecat)"
Cohesion: 0.40
Nodes (4): Build-day TODOs (marked in agent.py), How it fits, pipeline/ — Hebrew voice agent (Pipecat), Setup

### Community 22 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

## Knowledge Gaps
- **171 isolated node(s):** `name`, `version`, `private`, `type`, `main` (+166 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Repo` connect `Repo` to `runController.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `SupabaseRepo` connect `Repo` to `index.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `FakeRepo` connect `FakeRepo` to `runController.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _177 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `createServerClient` be split into smaller, more focused modules?**
  _Cohesion score 0.08069381598793364 - nodes in this community are weakly interconnected._
- **Should `runController.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07397959183673469 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._