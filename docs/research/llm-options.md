# LLM options for typed output on or alongside AWS

Ticket: [#5](https://github.com/Bill2926/COS40005_HN9_Verifiable_Co-Learner_Agent/issues/5) — "Which LLM options give reliable typed output on or alongside AWS?"
Researched: 2026-10-07, against official docs, model cards, pricing pages and the AWS Price List API (sources at the bottom; `[n]` marks the source for each claim).
Scope: the two LLM jobs of the Synthesis engine — **Intent extraction** (classify a learner message into a typed Intent, possibly with concept tags) and **reply composition** (write a reply limited to the tutor moves the Verification middleware allows). This document lists facts and shortlists; the team's choice belongs to ticket #11.

## Short answer

- **Bedrock has native, grammar-constrained structured output.** The Converse API takes a JSON Schema in `outputConfig.textFormat`, and tools can be marked `strict: true`. Bedrock compiles the schema into a grammar and the response is constrained to it [3]. Support is **per model** and is listed on each model card [1][6].
- **Bedrock structured outputs: supported** by Claude Haiku 4.5 and Sonnet 4.6, OpenAI GPT-6 Luna / GPT-5.6 Luna / GPT-6 Sol, gpt-oss-20b/120b, Qwen3, Ministral 3, Mistral Large 3, Gemma 3 12B, Nemotron Nano 3 30B and DeepSeek V3.2, among others. **Not supported**: **all Amazon Nova models** (Micro, Lite, Pro, Nova 2 Lite), plus **Claude Sonnet 5 and Sonnet 5.5** [6]. Nova still gives schema-constrained JSON via forced tool use, because Nova applies constrained decoding whenever a tool config is passed [17].
- **Region reality.** From **ap-southeast-1 (Singapore)**, nearly every current frontier model (Claude 4.5+/5.x, GPT-5.6/6, Nova 2 Lite) is reachable only through **Global cross-Region inference**, which means requests may be processed in any commercial AWS Region. **ap-southeast-2 (Sydney)** also hosts more than 30 open-weight models **in-Region** (gpt-oss, Qwen3, Ministral/Mistral, Gemma 3, Nemotron, DeepSeek, GLM, MiniMax). It also offers **AU geo profiles** for Claude Haiku 4.5, Sonnet 4.6 and Sonnet 5 [2][6]. None of these open-weight models are offered in Singapore at all [2].
- **Cheap, typed candidates for high-volume Intent extraction** (standard price per 1M input/output tokens):
  - Nemotron Nano 3 30B: $0.062/$0.247, Sydney in-Region.
  - gpt-oss-20b: $0.072/$0.309, Sydney; Flex tier half that.
  - Gemma 3 12B: $0.093/$0.299, Sydney; legacy model.
  - **GPT-6 Luna**: $0.10/$0.50, Global; reachable from both regions.
  - Ministral 3 8B: $0.155/$0.155, Sydney.
  - Qwen3 32B: $0.155/$0.618, Sydney.
  - **Nova Micro**: $0.037/$0.148 in Sydney; tool-use JSON only.
  - Claude Haiku 4.5 at $1/$5 is about 10× pricier, and its "retire no sooner than" date is **mid-October 2026** [6][27].

  Sources: [6][7][8].
- **Reply composition candidates on Bedrock:**
  - With structured output: GPT-6 Sol ($2/$10 Global), Claude Sonnet 4.6 ($3/$15), Mistral Large 3 ($0.52/$1.55, Sydney), DeepSeek V3.2 ($0.64/$1.91, Sydney).
  - Without structured output: Claude Sonnet 5/5.5 ($2/$10). Adaptive thinking is on by default for these models [6][8].
- **External fallbacks all have strict JSON-schema output:**
  - OpenAI `gpt-6-luna`: $0.10/$0.50 [18][19].
  - Gemini `gemini-3.1-flash-lite`: $0.25/$1.50; `gemini-3.5-flash-lite`: $0.30/$2.50 [21][22].
  - Anthropic `claude-haiku-4-5`: $1/$5; `claude-sonnet-5-5`: $2/$10 [26][28].

  Bedrock Global prices for Claude Haiku 4.5, Claude Sonnet 5.5 and GPT-6 Luna match the vendors' first-party list prices [6][8][18][26].
- **Data use:**
  - **Bedrock** does not use inputs/outputs for training, does not share them with model providers, and by default does not store them [11][12].
  - Exceptions on Bedrock: the OpenAI GPT-5.4+/GPT-6 family keeps *classifier-flagged* traffic up to 30 days. Claude Fable 5/5.1 keep *all* traffic 30 days and require the `aws_review` retention mode [10][11].
  - **OpenAI, Anthropic and paid Gemini** do not train on API data, but each keeps content for abuse monitoring (OpenAI up to 30 days; Anthropic deletes within 30 days) [20][29].
  - **Free-tier Gemini** content *is* used to improve Google products and may be human-reviewed [23].

## How typed output works on each platform

| Platform | Mechanism | Schema limits worth knowing | Source |
| --- | --- | --- | --- |
| Bedrock (Converse / InvokeModel) | `outputConfig.textFormat` `{type: "json_schema"}` (Converse); `output_config.format` (InvokeModel, Claude); `response_format` (InvokeModel, open-weight); `strict: true` on tool definitions. Grammar compiled on first use (can take "up to a few minutes"), cached 24 h per account for identical schemas. | JSON Schema Draft 2020-12 subset: `enum`, `const`, `anyOf`/`allOf` (limited), internal `$ref` OK. **Not** supported: recursion, `minimum`/`maximum`, `minLength`/`maxLength`, `additionalProperties` other than `false`; `minItems` only 0 or 1. Incompatible with Anthropic citations. Not available on the `bedrock-mantle` Anthropic Messages path. Some geo profiles lack it (for example Haiku 4.5 via `in.`). | [3] |
| Bedrock, GPT-6 Luna / GPT-5.6 Luna / GPT-6 Sol via Converse | As above, **plus** `additionalModelRequestFields.text.format.strict = true` is mandatory. All fields must be `required` and `additionalProperties: false`. Non-streaming only. | — | [6] |
| Amazon Nova (no Bedrock structured outputs) | Define the schema as a tool and force it with `toolChoice`. Nova "leverage[s] constrained decoding… every time that a tool configuration is passed". | Nova docs recommend tool use for schemas with more than about 10 keys. | [17] |
| OpenAI API | Structured Outputs (`response_format` / `text.format` with `strict: true`, or strict function calling); GPT-4o and later. | Subset of JSON Schema. | [19] |
| Gemini API | `response_format` with `mime_type: application/json` + `schema`. | Supports `enum`, `minimum`/`maximum`, `minItems`/`maxItems`, `prefixItems`. Very large or deeply nested schemas may be rejected. Google advises validating values ("schema-compliant but semantically incorrect outputs"). | [22] |
| Anthropic API | `output_config.format` (JSON outputs) and `strict: true` tools, both via constrained decoding; GA (beta header no longer needed). | Limits: 20 strict tools, 24 optional params, 16 union-typed params per request. Grammar cached 24 h. **Enum casing is not guaranteed**: a value can differ from the schema only in capitalization, with no error raised. Refusals and `max_tokens` cut-offs can break the schema. | [28] |

## Comparison table — Amazon Bedrock candidates

Notes on the columns:
- **SO** means the model card lists Bedrock "Structured outputs" as supported on `bedrock-runtime` [6].
- **Access**: "In" = in-Region; "AU"/"APAC" = geographic cross-Region profile; "Global" = global cross-Region profile [2][6].
- **Prices** are Standard tier, USD per 1M input/output tokens, charged at the **source Region's** rate. For SG/SYD they come from the AWS Price List API files published 2026-09-30 to 2026-10-06 [8]; GPT-* prices come from the Bedrock model cards [6].
- **Speed** is the vendor's own positioning; AWS publishes no per-model latency figures.

| Model (Bedrock ID / profile) | SO | Tool use | Singapore access | Sydney access | Price SG | Price SYD | Tiers | Context | Speed / notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Amazon Nova Micro `amazon.nova-micro-v1:0` | No (tool-use constrained decoding instead) | Yes | APAC Geo (profile ID not printed on card) | In, Geo | $0.047 / $0.188 | $0.037 / $0.148 | Standard only | 128K | "Amazon's fastest text-only model… classification" [6] |
| Amazon Nova Lite `amazon.nova-lite-v1:0` | No | Yes | APAC Geo | In, Geo | $0.081 / $0.324 | $0.063 / $0.252 | Standard only | 300K | Low-cost multimodal [6] |
| Amazon Nova 2 Lite `global.amazon.nova-2-lite-v1:0` | No | Yes | Global | Global | $0.41 / $3.39 (see uncertainty 4) | $0.32 / $2.63 | Std, Priority, Flex | 1M | Launched 2025-12-02 [6] |
| Claude Haiku 4.5 `global.anthropic.claude-haiku-4-5-20251001-v1:0`, `au.…` | **Yes** | Yes | Global | AU Geo, Global | $1.00 / $5.00 | $1.00 / $5.00 (AU: $1.10 / $5.50) | Std, Reserved | 200K | Anthropic: "Fastest". **EOL no sooner than 2026-10-16** [6][27] |
| Claude Sonnet 4.6 `global.anthropic.claude-sonnet-4-6`, `au.…` | **Yes** | Yes | Global | AU Geo, Global | $3 / $15 | $3 / $15 (AU: $3.30 / $16.50) | Std, Reserved | 1M | Older tokenizer [6][26] |
| Claude Sonnet 5 `anthropic.claude-sonnet-5`, `global.…`, `au.…` | **No** | Not listed on card | **In-Region**, Global | AU Geo, Global | $2 / $10 (In: $2.20 / $11) | $2 / $10 (AU: $2.20 / $11) | Std | 1M | Adaptive thinking **on by default**, can be disabled [6] |
| Claude Sonnet 5.5 `global.anthropic.claude-sonnet-5-5` | **No** | Not listed on card | Global | Global | $2 / $10 | $2 / $10 | Std | 1M | Launched 2026-09-28. Adaptive thinking on by default, effort default `high`. Anthropic: "Fast" [6][27] |
| OpenAI GPT-6 Luna `global.openai.gpt-6-luna` | **Yes** (Converse needs `strict` flag) | Not listed | Global | Global | $0.10 / $0.50 (card) | $0.10 / $0.50 (card) | Std only | 1.05M | "Repeatable work at scale… extract information". Reasoning effort default `medium`, can be `none` [6] |
| OpenAI GPT-5.6 Luna `global.openai.gpt-5.6-luna` | **Yes** | Not listed | Global | Global | $0.20 / $1.20 (card) | same | Std only | 1.05M | "Fast and affordable… classification, routing… latency… matter most" [6] |
| OpenAI GPT-6 Sol `global.openai.gpt-6-sol` | **Yes** | Not listed | Global | Global | $2 / $10 (card) | same | Std only | 1.05M | Frontier; reasoning default `medium` [6] |
| gpt-oss-20b `openai.gpt-oss-20b-1:0` | **Yes** | Yes (mantle) | — | In | — | $0.072 / $0.309 (Flex $0.036 / $0.155) | Std, Priority, Flex | 128K | Open-weight [6][7] |
| gpt-oss-120b `openai.gpt-oss-120b-1:0` | **Yes** | Yes (mantle) | — | In | — | $0.155 / $0.618 (Flex half) | Std, Priority, Flex | 128K | [6][7] |
| Qwen3 32B `qwen.qwen3-32b-v1:0` | **Yes** | Yes | — | In | — | $0.155 / $0.618 | Std, Priority, Flex | **32K** | Hybrid thinking [6][7] |
| Ministral 3 8B `mistral.ministral-3-8b-instruct` | **Yes** | Yes | — | In | — | $0.155 / $0.155 | Std, Priority, Flex | 128K | Compact model [6][7] |
| Nemotron Nano 3 30B `nvidia.nemotron-nano-3-30b` | **Yes** | Yes | — | In | — | $0.062 / $0.247 | Std, Priority, Flex | 256K | [6][7] |
| Gemma 3 12B IT `google.gemma-3-12b-it` | **Yes** | Yes | — | In | — | $0.093 / $0.299 | Std, Priority, Flex | 128K | **Legacy, EOL 2027-03-30**. (Gemma 3 4B has no SO.) [6][7] |
| Mistral Large 3 `mistral.mistral-large-3-675b-instruct` | **Yes** | Yes | — | In | — | $0.515 / $1.545 | Std, Priority, Flex | 256K | Larger open-weight model for replies [6][7] |
| DeepSeek V3.2 `deepseek.v3.2` | **Yes** | Yes | — | In | — | $0.639 / $1.906 | Std, Priority, Flex | 164K | [6][7] |

Other Bedrock facts that matter:

- **Cross-Region pricing and routing:** there is no surcharge for cross-Region routing. AWS says Global is "approximately 10% savings" versus geographic profiles. Traffic stays on the AWS network, and CloudTrail logs the Region that actually served each request [5].
- **Service tiers:** Flex = 50% discount for latency-tolerant work; Priority = 75% premium; quota is shared across Priority/Standard/Flex [7][13]. Flex is **not** offered for Nova Micro/Lite, Claude or the GPT-6/5.6 family [6].
- **Latency-optimized inference** is a preview feature and only covers older models (Nova Pro, Claude 3.5 Haiku, Llama 3.1) in US Regions. It is not relevant here [14].
- **Model access:**
  - Most models are enabled by default.
  - Models with an AWS Marketplace product ID need `aws-marketplace:Subscribe` and a valid payment method. This applies to Claude and the GPT-5.6/6 family; Nova and the AWS-served open-weight models have no product ID.
  - Anthropic models also need a one-time "first time use" form. A student can give a GitHub or project URL in place of a company website.

  Sources: [16][6].
- **One API for all models:** the Converse API is a "unified, model-agnostic interface" [1].

## Comparison table — external APIs (fallback, called from AWS)

| Provider / model | Typed output | Price per 1M in / out (Standard) | Discounts | Data use and retention | Notes |
| --- | --- | --- | --- | --- | --- |
| OpenAI `gpt-6-luna` | Structured Outputs (strict JSON Schema; strict function calling) [19] | $0.10 / $0.50 [18] | Batch and Flex tabs both show $0.05 / $0.25 (tab-to-table mapping inferred from page order) [18] | Not used for training unless you opt in; abuse-monitoring logs keep content up to 30 days; ZDR/MAM need approval [20] | Singapore (`sg.api.openai.com`) and Australia data residency = **storage only, not processing**, and needs MAM/ZDR approval [20] |
| OpenAI `gpt-6.1-sol` | same | $2 / $10 [18] | Batch/Flex $1 / $5 | same | — |
| Google `gemini-3.1-flash-lite` | JSON Schema subset [22] | $0.25 / $1.50 [21] | Batch/Flex $0.125 / $0.75 | Paid tier: not used to improve products; logged for a limited period for abuse detection [23] | Shutdown no earlier than 2027-05-07; replacement `gemini-3.5-flash-lite` [24] |
| Google `gemini-3.5-flash-lite` | same | $0.30 / $2.50 [21] | Batch/Flex $0.15 / $1.25 | same | Released 2026-07-21 [24] |
| Google `gemini-3.8-flash` | same | $0.75 / $3.75 until 2026-12-31, then $1.50 / $7.50 [21] | Batch/Flex half | same | — |
| Google `gemini-2.5-flash-lite` | same | $0.10 / $0.40 [21] | — | same | Access limited to users who already used it; Google points new projects to 3.5 Flash-Lite [24] |
| Google, **free tier** | same | $0 | — | **Content used to improve Google products; human reviewers may read it** [23] | Unsuitable for learner data |
| Anthropic `claude-haiku-4-5` | JSON outputs + strict tools [28] | $1 / $5 [26] | Batch 50% [26] | Deleted within 30 days; not used for training; flagged content kept up to 2 years [29] | Retirement no sooner than 2026-10-15; no newer Haiku in the current lineup [27] |
| Anthropic `claude-sonnet-5-5` | JSON outputs + strict tools (per-model support not stated; see uncertainty 7) | $2 / $10 [26] | Batch 50% | same | Claude 4.7+ tokenizer produces about 30% more tokens for the same text [26] |

Gemini API terms also require users to be **18 or older**, and forbid use in services "directed towards or likely to be accessed by" under-18s [23]. The Gemini API is available in Vietnam, Singapore and Australia [25]. Anthropic also sells "Claude Platform on AWS": an Anthropic-operated service using first-party API features and model IDs, billed through AWS Marketplace [26][27].

## Notes per job

### Intent extraction

- **Shape:** a small object such as `{intent: enum, concept_tags: [enum|string], confidence?: …}`. This fits inside every platform's schema subset. Bedrock rejects numeric bounds, so a `confidence` in [0,1] cannot be enforced by the schema [3]. Gemini does allow `minimum`/`maximum` [22].
- **The LLM output is still only an input.** Anthropic documents that strict schemas can still return an enum value that differs only in capitalization, or break on refusal or `max_tokens` [28]. Google tells users to validate values themselves [22]. A deterministic parse-and-validate step in front of the Verification middleware is therefore still needed. This matches CONTEXT.md: LLMs supply inputs and never make the decision.
- **Grammar warm-up:** the first call with a new schema can take minutes while Bedrock compiles the grammar; identical schemas are cached for 24 h [3]. Benchmark runs should warm the schema first and keep it byte-identical across calls.
- **Illustrative replay cost.** Assumption, not measured: 1,500 input + 100 output tokens per call, so 10,000 replayed turns = 15M in + 1M out. Excludes thinking/reasoning tokens (billed as output) and the injected format prompt.

  | Model | Approx. cost |
  | --- | --- |
  | Nova Micro (Sydney) | $0.70 |
  | gpt-oss-20b, Sydney Flex | $0.70 |
  | Nemotron Nano 3 30B (Sydney) | $1.17 |
  | gpt-oss-20b, Sydney Standard | $1.39 |
  | GPT-6 Luna (Global) | $2.00 |
  | Ministral 3 8B (Sydney) | $2.47 |
  | Gemini 3.1 Flash-Lite | $5.25 |
  | Nova 2 Lite (Sydney) | $7.43 |
  | Nova 2 Lite (Singapore) | $9.54 |
  | Claude Haiku 4.5 | $20 |
  | Claude Sonnet 5/5.5 | $40 (before the ~30% tokenizer effect) |

  Rates from [6][7][8][21][26].
- **Discount routes for replays:**
  - **Flex** (synchronous, 50% off, keeps structured output) exists for the Sydney open-weight models and Nova 2 Lite, but not for Claude or GPT-6 Luna [6][13].
  - **Batch** (50% off) needs S3 input/output and does not keep record order [15].
  - AWS docs contradict each other on whether batch supports structured output (see uncertainty 2).
- **Speed for the live app:** Nova Micro, GPT-5.6 Luna and Claude Haiku 4.5 are each positioned by their vendor as the fastest or latency-focused option [6][27]. GPT-6 Luna defaults to `medium` reasoning effort; setting `none` is allowed [6]. No vendor publishes comparable latency numbers.

### Reply composition (constrained to allowed tutor moves)

- **Typed-output option:** wrap the reply as `{move: enum, text: string}` so the middleware can check `move` against the allowed set before showing the text. Bedrock caches grammars per identical schema, and a new schema triggers compilation [3]. *Inference:* building a fresh `enum` of allowed moves on every request could force repeated compilations. A fixed enum of **all** moves, followed by a deterministic membership check, avoids that.
- **Bedrock models with structured output and stronger writing:** GPT-6 Sol ($2/$10 Global), Claude Sonnet 4.6 ($3/$15; AU profile keeps data in Australia from Sydney), Mistral Large 3 and DeepSeek V3.2 (Sydney in-Region) [6][8].
- **Claude Sonnet 5/5.5** cost less than Sonnet 4.6 per token ($2/$10), but have **no Bedrock structured outputs**. Their adaptive thinking is on by default, which adds output tokens and latency unless turned down or off [6]. On Bedrock they would need plain text plus post-hoc checks.
- **Prompt caching** helps with long, fixed system prompts such as pedagogical rubrics:
  - Claude Sonnet 5: 1,024-token minimum, 5 min or 1 h TTL.
  - Nova 2 Lite: 1K-token minimum, 20K maximum cached.
  - GPT-6 Luna: 1,024-token prefix, 30 min TTL.

  Sources: [6].
- **Not recommended for this job:** Claude Fable 5/5.1 ($10/$50). Bedrock requires the `aws_review` retention mode for them (up to 30 days of retention with possible AWS human review), and refusal rates are "materially higher than on previous Claude models" [6][10][11].

## Data residency and retention summary

| Route | Training on your data | Default retention | Where data may be processed |
| --- | --- | --- | --- |
| Bedrock, most models | No; not shared with providers [12] | None ("zero operator access", "zero data retention" by default) [11] | In-Region / geography / anywhere commercial, depending on the profile used [2]. Retained data under cross-Region inference sits in the destination Region [11] |
| Bedrock, GPT-5.4+/GPT-6 family | No | Classifier-flagged traffic up to 30 days, stored by AWS [11] | Global profile only from SG/SYD [2][6] |
| Bedrock, Claude Fable 5/5.1 | No | All traffic up to 30 days; requires `aws_review` mode [10][11] | — |
| OpenAI API | No (unless opted in) [20] | Abuse logs up to 30 days [20] | Global; SG residency = storage only [20] |
| Gemini API, paid | No [23] | Limited-period logging for abuse [23] | Not specified in the terms |
| Gemini API, free | **Yes** [23] | — | — |
| Anthropic API | No [29] | Deleted within 30 days; flagged up to 2 years [29] | Global default; `inference_geo: "us"` costs 1.1× [26] |

Bedrock retention is set per Region with `PUT /data-retention` (modes `none` < `default` < `aws_review`). At launch there was no console UI for it [10].

## Open uncertainties

1. **Account type changes the picture (UNVERIFIED).** An AWS Academy Learner Lab handout hosted by a third party (not an AWS page; undated) says all service access is limited to us-east-1/us-west-2. It also says Marketplace subscriptions have "extremely limited read-only access" [30]. If that applies, Claude and GPT-5.6/6 on Bedrock, which need Marketplace subscription [16], may be unusable, while Nova and AWS-served open-weight models might still work. Nova Lite, gpt-oss, Qwen3, Ministral 3, Gemma 3 12B and Nemotron Nano 3 are in-Region in both us-east-1 and us-west-2; Nova Micro is in-Region in us-east-1 only; Claude and GPT-6 Luna are Geo/Global there [2]. This needs the AWS-account ticket's answer and a hands-on test.
2. **Batch + structured output conflict.** The structured-outputs page lists batch inference as "Yes" [3]. The batch-inference page says batch "does not support tool calling… or structured output (`response_format`)" [15]. Test before relying on batch for replays.
3. **Nova Micro/Lite from Singapore.** The regional table marks Singapore as Geo-supported, but the model cards print only `us.`/`eu.` profile IDs [2][6]. Verify with `aws bedrock list-inference-profiles --region ap-southeast-1`.
4. **Nova 2 Lite Singapore price looks anomalous:** $0.41/$3.39 versus $0.32/$2.63 in Sydney and $0.30/$2.50 in us-east-1 (Global). The figure is as published in the Price List file dated 2026-10-06 [8]; confirm in the console or billing.
5. **GPT-6 Luna / GPT-5.6 Luna** are absent from the SG/SYD Price List files; their prices come from the model cards only [6][8].
6. **Claude Haiku 4.5 retirement.** Bedrock card: EOL no sooner than 2026-10-16. Anthropic: retirement no sooner than 2026-10-15. Neither lists a successor Haiku [6][27]. It could disappear mid-project.
7. **Claude Sonnet 5/5.5 structured output.** The Bedrock cards explicitly mark it unsupported [6]. Anthropic's first-party docs do not restrict structured outputs by model, but the per-platform availability marks did not render in the fetched page [28]. First-party or Claude Platform on AWS support for these models is UNVERIFIED. The Bedrock cards also do not list "client-side tool calling" for Sonnet 5/5.5, although Anthropic says all current models support tool use [27].
8. **Latency is unmeasured.** No vendor publishes comparable numbers, and Global routing from Singapore may serve requests from distant Regions (CloudTrail `inferenceRegion` shows where) [5]. A small latency probe is needed.
9. **Bedrock grammar complexity limits** (number of enum values, optional fields) are not documented. Anthropic documents limits for its own API only [3][28]. A large concept-tag enum could hit undocumented limits.
10. **Tokenizers differ.** Claude 4.7+ uses about 30% more tokens for the same text [26], so per-token prices are not directly comparable across vendors.
11. **OpenAI Batch vs Flex prices:** the tab-to-table mapping on the pricing page was inferred from order [18].
12. **Gemini 18+ rule** [23] may conflict with any under-18 first-year students.

## Sources

All accessed 2026-10-07.

1. AWS, "Models at a glance" (Amazon Bedrock User Guide) and "API compatibility" — https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.html ; https://docs.aws.amazon.com/bedrock/latest/userguide/models-api-compatibility.html
2. AWS, "Regional availability by models" — https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html (parsed from the `.md` rendition to keep the yes/no icons)
3. AWS, "Get validated JSON results from models" (structured outputs) — https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html
4. AWS, "Use a tool to complete an Amazon Bedrock model response" — https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use.html
5. AWS, "Route model inference requests across AWS Regions with cross-Region inference" — https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html
6. AWS Bedrock model cards, `https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-<slug>.html`, slugs: amazon-nova-micro, amazon-nova-lite, amazon-nova-pro, amazon-nova-2-lite, anthropic-claude-haiku-4-5, anthropic-claude-sonnet-4-6, anthropic-claude-sonnet-5, anthropic-claude-sonnet-5-5, anthropic-claude-fable-5, anthropic-claude-fable-5-1, openai-gpt-6-luna, openai-gpt-56-luna, openai-gpt-6-sol, openai-gpt-oss-20b, openai-gpt-oss-120b, qwen-qwen3-32b, qwen-qwen3-next-80b-a3b, mistral-ai-ministral-3-8b, mistral-ai-ministral-3b, mistral-ai-mistral-large-3, google-gemma-3-12b-it, google-gemma-3-4b-it, google-gemma-4-31b, nvidia-nemotron-nano-3-30b, nvidia-nvidia-nemotron-nano-9b-v2, deepseek-deepseek-v3-2, zai-glm-4-7-flash, zai-glm-5-3, moonshot-ai-kimi-k3, xai-grok-4-7, meta-llama-4-scout-17b-instruct
7. AWS, "Amazon Bedrock pricing" — https://aws.amazon.com/bedrock/pricing/ (Sydney tables for open-weight models; Nova/Anthropic tables did not render, hence [8])
8. AWS Price List API bulk files (publication dates 2026-09-30 to 2026-10-06): `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/{AmazonBedrock|AmazonBedrockFoundationModels}/current/{ap-southeast-1|ap-southeast-2|us-east-1}/index.json`
9. AWS, "Data protection" (Bedrock) — https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html
10. AWS, "Data retention" (Bedrock) — https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html
11. AWS, "Amazon Bedrock abuse detection" — https://docs.aws.amazon.com/bedrock/latest/userguide/abuse-detection.html
12. AWS, "Amazon Bedrock FAQs" — https://aws.amazon.com/bedrock/faqs/
13. AWS, "Service tiers for optimizing performance and cost" — https://docs.aws.amazon.com/bedrock/latest/userguide/service-tiers-inference.html
14. AWS, "Optimize model inference for latency" — https://docs.aws.amazon.com/bedrock/latest/userguide/latency-optimized-inference.html
15. AWS, "Process multiple prompts with batch inference" and "Format and upload your batch inference data" — https://docs.aws.amazon.com/bedrock/latest/userguide/batch-inference.html ; https://docs.aws.amazon.com/bedrock/latest/userguide/batch-inference-data.html
16. AWS, "Request access to models" — https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html
17. AWS, Amazon Nova 2 User Guide, "Using tools (function calling)" — https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-tools.html ; "Advanced prompting techniques" — https://docs.aws.amazon.com/nova/latest/nova2-userguide/advanced-prompting-techniques.html
18. OpenAI, "Pricing" — https://platform.openai.com/docs/pricing
19. OpenAI, "Structured model outputs" — https://platform.openai.com/docs/guides/structured-outputs
20. OpenAI, "Data controls in the OpenAI platform" — https://platform.openai.com/docs/guides/your-data
21. Google, "Gemini Developer API pricing" (last updated 2026-10-07) — https://ai.google.dev/gemini-api/docs/pricing
22. Google, "Structured outputs" (last updated 2026-09-23) — https://ai.google.dev/gemini-api/docs/structured-output
23. Google, "Gemini API Additional Terms of Service" — https://ai.google.dev/gemini-api/terms
24. Google, "Gemini deprecations" (last updated 2026-10-07) — https://ai.google.dev/gemini-api/docs/deprecations
25. Google, "Available regions for Google AI Studio and Gemini API" — https://ai.google.dev/gemini-api/docs/available-regions
26. Anthropic, "Pricing" — https://docs.claude.com/en/docs/about-claude/pricing
27. Anthropic, "Models overview" — https://docs.claude.com/en/docs/about-claude/models/overview
28. Anthropic, "Structured outputs" and "Features overview" — https://docs.claude.com/en/docs/build-with-claude/structured-outputs ; https://docs.claude.com/en/docs/build-with-claude/overview
29. Anthropic Privacy Center, "How long do you store my organization's data?" — https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data ; "API and data retention" — https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
30. *Secondary source.* "AWS Academy Learner Lab – Foundation Services" (AWS Academy handout, hosted by University of the Pacific, undated) — https://cyberlab.pacific.edu/courses/comp175/resources/aws-academy/AWS_Academy_Learner_Lab-Foundational_Services.pdf
