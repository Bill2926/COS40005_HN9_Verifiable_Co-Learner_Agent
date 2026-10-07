# What can each AWS account option run for this stack?

Research for ticket [#3](https://github.com/Bill2926/COS40005_HN9_Verifiable_Co-Learner_Agent/issues/3) (map: [#1](https://github.com/Bill2926/COS40005_HN9_Verifiable_Co-Learner_Agent/issues/1)).
Researched 2026-10-07. Prices come from the AWS Price List bulk files published 2026-10-07 [S15] and are USD, pre-tax, on-demand.
Citations are `[Sn]`; see [Sources](#sources). Anything not confirmed from a primary source is marked **UNVERIFIED**.

## Answer summary

- **Personal/team account, Free plan (credit-based, accounts created after 2025-07-15).** New customers get USD 100 of credits at sign-up and can earn up to USD 100 more. The plan ends after 6 months or when credits run out, whichever comes first; the account is then closed, and you have 90 days to upgrade to the Paid plan [S1][S2][S3]. Every service in both deployment shapes is on AWS's Free Tier service list for the new sign-up experience: Bedrock, Lambda, API Gateway, DynamoDB, S3, CloudFront, Cognito, ECS, RDS and Elastic Load Balancing [S8][S9].
- **Region catch, new sign-up experience.** AWS assigns the region from your contact address, and you cannot change it. A Vietnam address goes to **Asia Pacific (Sydney) `ap-southeast-2`** [S9]. On the Free plan, Bedrock **Geographic and Global cross-Region inference are not supported** [S8]. No Claude model runs In-Region in Sydney; all of them need cross-Region profiles [S11]. **So the only Bedrock models usable from a Sydney Free-plan project are the In-Region ones**: Amazon Nova Micro/Lite/Pro, Titan/Cohere embeddings, and open-weight models such as gpt-oss, Qwen3, DeepSeek V3.2, Mistral Large 3 and Kimi K2.5 [S11]. The "advanced" sign-up lets you pick any region [S7].
- **Claude access is doubly uncertain on the Free plan.** First, Anthropic models are sold as AWS Marketplace "Third-Party Content" [S13][S15]. Marketplace model access requires a valid payment method [S12], and promotional credits do not apply to AWS Marketplace charges "unless authorized" [S10]. Whether Free Tier credits cover Claude is therefore **UNVERIFIED**, and the signs point to "no". Second, AWS says Bedrock APIs that don't create resources can be called in any default-enabled region. That would include Singapore, where Claude Sonnet 5 is In-Region [S9][S11][S14]. This route is documented but **untested**.
- **AWS Academy Learner Lab.** Each student gets a temporary AWS account, usable while a **4-hour session timer** runs; pressing Start Lab again resets the timer [S21][S24]. The budget is **USD 100 per student per class** (2021 Educator Guide) [S21]. Exceeding the budget disables the account and deletes everything [S24]. Only **`us-east-1` and `us-west-2`** are allowed. You **cannot create IAM users, groups or roles**; you must use the pre-created `LabRole` [S22][S24]. The newest Readme copy found (2024-08-06) lists API Gateway, Lambda (max 10 concurrent execution environments), DynamoDB, S3, ECS, Fargate and RDS PostgreSQL [S24]. **Bedrock appears in no Learner Lab document found**, and Cognito and CloudFront appear only in older versions, so all three are **UNVERIFIED** for Learner Lab.
- **Rough monthly cost, Shape A (serverless).** Infrastructure is about **USD 0.30–2.40/month** in Sydney. Bedrock then dominates: about USD 0.60–3.80/month with Nova Lite, 11.50–71.50 with Claude Haiku 4.5, or 23–143 with Claude Sonnet 5.
- **Rough monthly cost, Shape B (containers).** Infrastructure is about **USD 35/month** without a load balancer, or **USD 60/month** with an Application Load Balancer (Sydney). The Bedrock cost is the same as Shape A. In `us-east-1` (Learner Lab), the infrastructure is about USD 27 or 50/month. That uses up a USD 100 budget in roughly 2–4 months before any LLM spend.

## Account options at a glance

| | AWS Academy Learner Lab | Personal/team account: Free plan | Personal/team account: Paid plan |
| --- | --- | --- | --- |
| Who can get it | Students in a class created by an AWS Academy educator; the institution must be an AWS Academy member [S20][S21] | New AWS customers only; ineligible if you have, or ever had, an AWS account [S2] | Anyone |
| Money | USD 100 AWS Platform Credit per student per class [S21] (amount for your class: **UNVERIFIED**) | USD 100 at sign-up plus up to USD 100 for five activities, one of which is a Bedrock playground prompt [S3][S5] | The same Free Tier credits; you pay beyond them [S3] |
| What happens at the limit | Exceed the budget and the lab account is disabled, with "all progress and resources … lost" [S24] | The plan ends at 6 months or when credits are gone; the account is closed and data is kept 90 days pending upgrade [S2][S3] | Usage beyond credits is billed. New sign-up experience only: optional spend limit (minimum USD 20/month) that pauses the project [S2][S9] |
| Credit expiry | Class end date set by the educator [S21] | 6 months (the plan's lifetime) [S2] | **Inconsistent on AWS's own FAQ**: "6 months" in two answers, "12 months" in two others [S2]; the 2025 launch post says 12 months [S6] |
| Regions | `us-east-1` and `us-west-2` only [S22][S24] | New sign-up: one assigned region (Vietnam goes to `ap-southeast-2`), no opt-in regions [S7][S9]. Advanced sign-up: you choose [S7] | Advanced features (all regions) require the Paid plan [S7][S25] |
| IAM | Cannot create users, groups or roles (service-linked roles excepted); attach `LabRole` to Lambda, ECS tasks and so on [S22][S24] | New sign-up: AWS-managed organization and SCPs; IAM users/roles only for programmatic access; teammates can be invited with admin access to a project [S7][S9] | Same as the Free plan; with advanced features, full IAM [S7] |
| Session | 4-hour session timer, renewable; resources persist between sessions; EC2 is stopped at session end and restarted on the next start; RDS may keep running [S21][S24] | No session limit | No session limit |
| Other limits | Marketplace subscriptions: "extremely limited read-only access" [S22][S24]; budget display lags 8–12 h [S24]; "Reset" wipes the account but not the budget [S24] | Not eligible for other promotional credits [S2][S3]; services that would rapidly consume credits are blocked [S2][S4] | None beyond normal quotas |

## Service-by-service availability

Legend: ✅ documented as available · ⚠️ available with a documented restriction · ❓ UNVERIFIED (not found in any primary or AWS-authored source).

| Service | Learner Lab (`us-east-1`/`us-west-2`) | Free plan, new sign-up experience (Vietnam → `ap-southeast-2`) | Free plan, advanced sign-up | Paid plan |
| --- | --- | --- | --- | --- |
| Amazon Bedrock | ❓ Not listed in any Learner Lab service list found [S22][S23][S24]. Even if present, Marketplace is read-only [S24], so third-party (Marketplace-sold) models would likely fail to auto-subscribe [S12] (inference) | ⚠️ Allowed by the Free Tier SCP (`bedrock:*`) [S9]. **Geo/Global cross-Region inference not supported** [S8]. Marketplace "Bedrock and Free only" [S8]. Third-party models need a payment method [S12] | ✅ On the service list (Bedrock is a credit-earning activity) [S5]; cross-Region inference restriction **UNVERIFIED** for this path | ✅ |
| AWS Lambda | ✅ Use `LabRole`; max 10 concurrent execution environments [S24] | ✅ (Lambda@Edge not supported) [S8] | ✅ [S5] | ✅ |
| API Gateway WebSocket APIs | ✅ API Gateway listed [S24] (WebSocket specifically: not separately mentioned) | ✅ `apigateway:*` and `execute-api:*` allowed [S8][S9] | ❓ Service list not published for this path | ✅ |
| Amazon DynamoDB | ✅ [S22][S24] | ✅ (no Global Tables) [S8] | ❓ | ✅ |
| Amazon S3 | ✅ [S22][S24] | ✅ (no cross-Region replication) [S8] | ❓ | ✅ |
| Amazon CloudFront | ❓ Listed in the 2021 versions [S22][S23], absent from the 2024-08-06 Readme [S24] | ⚠️ Allowed [S8], but features that create resources outside the project's region are unavailable, including AWS WAF with CloudFront [S9]; Lambda@Edge not supported [S8] | ❓ | ✅ |
| Amazon Cognito | ❓ Listed only in the earliest (2021-07) version [S23]; absent from [S22][S24] | ✅ `cognito-idp:*` allowed [S8][S9] | ❓ | ✅ |
| Amazon ECS on Fargate | ✅ ECS and Fargate listed; set `LabRole` as both task role and task execution role [S24] | ✅ `ecs:*` allowed [S8][S9] | ❓ | ✅ |
| Amazon RDS for PostgreSQL | ⚠️ nano–medium instance classes, gp2 storage ≤ 100 GB, on-demand only, no Enhanced Monitoring [S22][S24] | ✅ (no cross-Region read replicas) [S8] | ✅ RDS is a credit-earning activity [S5] | ✅ |

"❓" in the advanced sign-up Free-plan column means AWS publishes the Free-plan service list only as a filter on the Free Tier web page [S1][S2]; the machine-readable list is only for the new sign-up experience [S8].

## Bedrock models near Vietnam

Source: the per-model availability tables in the Bedrock User Guide [S11], parsed from the page HTML on 2026-10-07. "In" means In-Region, either the `bedrock-runtime` or the `bedrock-mantle` endpoint. Prices are Sydney on-demand, USD per 1M input/output tokens [S15]. For Claude in Sydney, the "standard" (Geo) price is 10% above the "global" price.

| Model | Sydney `ap-southeast-2` | Singapore `ap-southeast-1` | N. Virginia `us-east-1` | Sydney price (in / out per 1M) |
| --- | --- | --- | --- | --- |
| Amazon Nova Micro | In, Geo | Geo | In, Geo | 0.037 / 0.148 |
| Amazon Nova Lite | In, Geo | Geo | In, Geo | 0.063 / 0.252 |
| Amazon Nova Pro | In, Geo | Geo | In, Geo | 0.84 / 3.36 |
| Amazon Nova 2 Lite | Global only | Global only | Geo, Global | 0.32 / 2.63 (global) |
| OpenAI gpt-oss-120b | In | not offered | In | 0.1545 / 0.618 |
| Qwen3 32B | In | not offered | In | 0.1545 / 0.618 |
| DeepSeek V3.2 | In | not offered | In | 0.64 / 1.91 |
| Mistral Large 3 | In | not offered | In | 0.515 / 1.545 |
| Kimi K2.5 | In | not offered | In | 0.62 / 3.09 |
| Claude Haiku 4.5 | Geo, Global | Global only | In (mantle), Geo, Global | 1.10 / 5.50 Geo; 1.00 / 5.00 Global |
| Claude Sonnet 4.6 | Geo, Global | Global only | Geo, Global | 3.30 / 16.50 Geo; 3.00 / 15.00 Global |
| Claude Sonnet 5 | Geo, Global | **In** (runtime + mantle), Global | In (mantle), Geo, Global | 2.20 / 11.00 Geo; 2.00 / 10.00 Global |
| Claude Sonnet 5.5 | Global only | Global only | Geo, Global | 2.20 / 11.00; 2.00 / 10.00 Global |
| Claude Opus 5.5 | Geo, Global | Global only | In (mantle), Geo, Global | 4.40 / 22.00; 4.00 / 20.00 Global |
| Titan Text Embeddings V2 | In | not offered | In | — |
| Cohere Embed Multilingual | In | In | In | — |

Notes:

- Claude 3 Haiku reached end of life on 2026-09-10 and Claude Sonnet 4 does on 2026-10-14 [S11], so neither is a candidate.
- Model access is on by default. Anthropic models on `bedrock-runtime` need a one-time First Time Use form, which is not required on `bedrock-mantle`. Third-party models auto-subscribe through AWS Marketplace on first call, which needs `aws-marketplace:Subscribe` permission and a valid payment method [S12].
- Amazon, DeepSeek, Google, Meta, MiniMax, Mistral AI, Moonshot AI, NVIDIA, Qwen, xAI and Z.AI models, plus OpenAI's open-weight gpt-oss models, are **not** sold through Marketplace [S12]. Claude is: its prices are in the `AmazonBedrockFoundationModels` price list as "AWS Marketplace software usage" [S15].
- Melbourne (`ap-southeast-4`) has Claude In-Region but is an opt-in region [S9][S11]. The new sign-up experience cannot access opt-in regions [S7].

## Other limits that matter for this stack

| Limit | Value | Source |
| --- | --- | --- |
| API Gateway WebSocket maximum connection duration | 2 hours (not increasable) | [S19] |
| API Gateway WebSocket idle timeout | 10 minutes (not increasable) | [S19] |
| API Gateway integration timeout (incl. Lambda) | 50 ms – 29 s (not increasable) | [S19] |
| WebSocket frame / message size | 32 KB frame, 128 KB message | [S19] |
| New WebSocket connections per second per account per region | 500 (increasable) | [S19] |
| Learner Lab Lambda concurrency | max 10 concurrent execution environments | [S24] |
| Learner Lab EC2 | max 9 concurrent instances and 32 vCPU per region; 20 or more running instances deactivates the account | [S22][S24] |
| Public IPv4 addresses (Fargate task, ALB nodes, RDS if public) | USD 0.005/hour each; load balancers consume them too | [S15][S17][S18] |

## Rough monthly cost per deployment shape

### Assumptions

- **Users:** about 15 monthly active users (5 developers plus about 10 testers), so Cognito stays inside its free 10,000 MAU [S15].
- **LLM calls, Base scenario:** 3,000 calls/month at 2,000 input and 300 output tokens each, i.e. 6M input and 0.9M output tokens.
- **LLM calls, High scenario:** 10,000 calls/month at 4,000 input and 500 output tokens each, i.e. 40M input and 5M output tokens.
- **Shape A traffic:**
  - S3: 1 GB stored, 50k GET and 1k PUT requests.
  - CloudFront: the USD 0/month flat-rate Free plan (1M requests, 100 GB) [S16].
  - API Gateway WebSocket: 100k messages and 20k connection-minutes (Base); 1M messages and 100k connection-minutes (High).
  - Lambda: 20k invocations and 10k GB-s (Base); 100k invocations and 150k GB-s (High). Both fit inside the free 1M requests and 400k GB-s [S15]. Without that allowance, Lambda would cost about USD 0.17 (Base) or 2.52 (High).
  - DynamoDB on-demand: 100k writes and 200k reads (Base); 10× that (High). Storage is under the free 25 GB [S15].
  - CloudWatch Logs: under the free 5 GB [S15].
- **Shape B footprint:**
  - One Fargate task with 0.25 vCPU and 0.5 GB, running 24×7 (730 h). A 0.5 vCPU / 1 GB variant is shown separately.
  - RDS PostgreSQL `db.t4g.micro`, Single-AZ, 20 GB storage. Learner Lab requires gp2; gp2 and gp3 cost the same here [S15].
  - Either the task has a public IPv4 address (no ALB), or an ALB with 2 public IPv4 addresses and 0.5 LCU on average.
  - Frontend on S3 + CloudFront as in Shape A.
- **Excluded:** data transfer out, NAT gateway (avoidable with public subnets), ECR storage, Secrets Manager, Route 53, embeddings and Guardrails, RDS backups, and taxes.

### Bedrock cost (USD/month, the same for both shapes)

| Model (where it runs) | Base | High |
| --- | --- | --- |
| Nova Micro (Sydney, In-Region) | 0.36 | 2.22 |
| Nova Lite (Sydney, In-Region) | 0.60 | 3.78 |
| gpt-oss-120b or Qwen3 32B (Sydney, In-Region) | 1.48 | 9.27 |
| Nova Pro (Sydney, In-Region) | 8.06 | 50.40 |
| Claude Haiku 4.5 (Sydney, Geo) | 11.55 | 71.50 |
| Claude Sonnet 5 (Singapore In-Region, or Sydney Geo) | 23.10 | 143.00 |
| Claude Sonnet 4.6 (Sydney, Geo) | 34.65 | 214.50 |
| Nova Lite (`us-east-1`, e.g. Learner Lab if Bedrock is allowed) | 0.58 | 3.60 |

### Infrastructure cost, excluding Bedrock (USD/month)

| Shape | Sydney `ap-southeast-2` | N. Virginia `us-east-1` |
| --- | --- | --- |
| **A, serverless** (S3+CloudFront, API Gateway WebSocket, Lambda, DynamoDB, Cognito) | Base 0.29 · High 2.38 | Base 0.24 · High 1.95 |
| **B, containers, minimal** (Fargate 0.25 vCPU/0.5 GB + public IPv4, RDS `db.t4g.micro` 20 GB) | 35.46 | 26.64 |
| **B, with ALB** (as above, ALB instead of the task's public IP) | 60.43 | 49.64 |
| **B, with ALB and a 0.5 vCPU/1 GB task** | 71.23 | 58.65 |

Unit prices used (Sydney / `us-east-1`) [S15]:

- **Fargate:** USD 0.04856 / 0.04048 per vCPU-hour; 0.00532 / 0.004445 per GB-hour.
- **RDS PostgreSQL `db.t4g.micro` Single-AZ:** 0.025 / 0.016 per hour; storage 0.138 / 0.115 per GB-month.
- **ALB:** 0.0252 / 0.0225 per hour; 0.008 per LCU-hour.
- **API Gateway WebSocket:** 1.30 / 1.00 per million messages; 0.325 / 0.25 per million connection-minutes.
- **DynamoDB on-demand:** 0.71 / 0.625 per million write request units; 0.1425 / 0.125 per million read request units.
- **S3 Standard:** 0.025 / 0.023 per GB-month.
- **Lambda:** 0.20 per million requests; 0.0000166667 per GB-second (x86).

### What the credits buy

- **Free plan, Shape A + an In-Region Nova or open-weight model:** under USD 2/month at Base. The USD 100 sign-up credit outlasts the 6-month plan lifetime.
- **Free plan, Shape B:** about USD 36–61/month plus the LLM. USD 100 lasts about 1.6–2.8 months; the full USD 200 lasts about 3.3–5.6 months. That is still capped at 6 months.
- **Learner Lab (`us-east-1`), Shape B:** about USD 27–50/month before any LLM spend. USD 100 lasts about 2–3.7 months. Note the Readme says RDS may keep running between sessions [S24]. Whether Fargate tasks are stopped at session end is **UNVERIFIED**.
- **Claude on a Free plan:** may not be payable from credits at all, because Marketplace charges are excluded from promotional credits unless AWS authorizes them [S10][S13]. **UNVERIFIED**; check the credit's "Applicable products" list in the Billing console [S26].

## Open uncertainties

1. **Bedrock in Learner Lab.** No Learner Lab source found mentions Bedrock [S22][S23][S24]. The authoritative list is the in-lab Readme, which sits behind the AWS Academy login. **UNVERIFIED.**
2. **Cognito and CloudFront in today's Learner Lab.** The copies found disagree across versions [S22][S23][S24]. **UNVERIFIED.**
3. **Learner Lab budget for this class.** The 2021 Educator Guide says USD 100 per student [S21]. Whether educators can change it, and what Swinburne's class would get, is **UNVERIFIED**.
4. **Learner Lab outside sessions.** Do Fargate tasks, Lambda and API Gateway keep serving users when nobody has a session open? The Readme only states that resources are retained, EC2 is stopped and RDS may keep running [S24]. **UNVERIFIED.**
5. **Free Tier credits and Claude.** Whether Free Tier credits cover Claude (an AWS Marketplace charge) [S10][S13], and whether a Free-plan account without a payment method can invoke Claude at all [S12]. **UNVERIFIED.**
6. **Calling Singapore from a Sydney-pinned project.** Can a new-experience Free-plan project in Sydney call Bedrock directly in Singapore (Claude Sonnet 5 In-Region)? It is implied by "APIs that do not create resources in all commercial AWS Regions that are enabled by default" [S9][S11]. **Untested.**
7. **Advanced sign-up Free plan.** Does the cross-Region-inference ban [S8] also apply to Free-plan accounts created through the advanced sign-up? And which of the stack's services are on that path's Free-plan list? **UNVERIFIED.**
8. **Which sign-up experience applies.** AWS says the new experience is "releasing … to a limited number of customers" [S7][S8], so a new team account may land on either path.
9. **Credit expiry.** AWS's own FAQ says both 6 and 12 months [S2].
10. **CloudFront flat-rate Free plan in the new experience.** The plan bundles AWS WAF [S16], but WAF with CloudFront is unavailable in new-experience projects [S9]. Compatibility is **UNVERIFIED**. Pay-as-you-go CloudFront per-GB prices were not extracted.

## Sources

Primary AWS sources:

- [S1] AWS Free Tier: <https://aws.amazon.com/free/>
- [S2] AWS Free Tier FAQs: <https://aws.amazon.com/free/free-tier-faqs/>
- [S3] AWS Billing User Guide, "Choosing a plan": <https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html>
- [S4] AWS Billing User Guide, "Explore AWS services with AWS Free Tier": <https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html>
- [S5] AWS Billing User Guide, "Earning additional credits": <https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans-activities.html>
- [S6] AWS News Blog, "AWS Free Tier update: New customers can get started and explore AWS with up to $200 in credits" (July 2025): <https://aws.amazon.com/blogs/aws/aws-free-tier-update-new-customers-can-get-started-and-explore-aws-with-up-to-200-in-credits/>
- [S7] AWS Account Management Guide, "Compare sign-up options": <https://docs.aws.amazon.com/accounts/latest/reference/sign-up-for-aws.html>
- [S8] AWS Account Management Guide, "Supported AWS services for Sign up for AWS (new)": <https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html>
- [S9] AWS Account Management User Guide (PDF). Sections used: "AWS Regions for your projects" (country table: Vietnam → `ap-southeast-2`), "Service control policies for the Free Tier for projects", "Create a spend limit in AWS Settings", "Invite team members", "Regional availability reference": <https://docs.aws.amazon.com/pdfs/accounts/latest/reference/AWSAccountManagementReferenceGuide.pdf>
- [S10] AWS Promotional Credit Terms & Conditions (last updated 2026-09-24): <https://aws.amazon.com/awscredits/>
- [S11] Amazon Bedrock User Guide, "Regional availability by models": <https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html>
- [S12] Amazon Bedrock User Guide, "Request access to models": <https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html>
- [S13] Amazon Bedrock FAQs ("Why do I see a billing entry for AWS Marketplace…"): <https://aws.amazon.com/bedrock/faqs/>
- [S14] AWS Machine Learning Blog, "Introducing Anthropic models on Amazon Bedrock for in-region inference in Seoul and Singapore": <https://aws.amazon.com/blogs/machine-learning/introducing-anthropic-models-on-amazon-bedrock-for-in-region-inference-in-seoul-and-singapore/>
- [S15] AWS Price List bulk files (offer index publication 2026-10-07). Offers used, for `ap-southeast-2` and `us-east-1`: `AmazonBedrock`, `AmazonBedrockFoundationModels`, `AWSLambda`, `AmazonApiGateway`, `AmazonDynamoDB`, `AmazonCognito`, `AmazonECS`, `AmazonRDS`, `AmazonVPC`, `AWSELB`, `AmazonS3`, `AmazonCloudWatch`: <https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/index.json>
- [S16] Amazon CloudFront pricing (flat-rate plans): <https://aws.amazon.com/cloudfront/pricing/>
- [S17] Elastic Load Balancing pricing ("Public IPv4 Address Charge"): <https://aws.amazon.com/elasticloadbalancing/pricing/>
- [S18] Amazon VPC pricing (public IPv4): <https://aws.amazon.com/vpc/pricing/>
- [S19] API Gateway Developer Guide, "Quotas for configuring and running a WebSocket in API Gateway": <https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-execution-service-websocket-limits-table.html>
- [S20] AWS Academy: <https://aws.amazon.com/training/awsacademy/>
- [S21] AWS Academy Learner Lab – Educator Guide (AWS-hosted PDF, © 2021, created 2021-06-18): <https://d1.awsstatic.com/AWS%20Academy%20Learner%20Lab%20Educator%20Guide.pdf>
- [S25] AWS, "How to Create an AWS Account" (advanced features require the Paid plan): <https://aws.amazon.com/resources/create-account/>
- [S26] AWS Billing User Guide, "Applying AWS credits" ("Applicable products" field): <https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/useconsolidatedbilling-credits.html>

AWS-authored Learner Lab documents that are only reachable through third-party mirrors. The text is AWS's, but the copies are not on an AWS domain, and their currency for 2026 is unknown:

- [S22] "AWS Academy Learner Lab – Foundation Services" (© 2021 AWS; PDF dated 2022-02-08), mirrored by the University of Queensland CSSE6400 course: <https://csse6400.uqcloud.net/resources/LearnerLab-Restrictions.pdf>
- [S23] The same document, an earlier version (PDF dated 2021-07-13), mirrored by the University of the Pacific COMP 175 course: <https://cyberlab.pacific.edu/courses/comp175/resources/aws-academy/AWS_Academy_Learner_Lab-Foundational_Services.pdf>
- [S24] The in-lab Learner Lab Readme, "Instructions last updated: 2024-08-06" (© 2022 AWS), in a user-uploaded copy on studylib.net: <https://studylib.net/doc/27689384/aws-learner-lab>

Forum answers on AWS re:Post about credits and Bedrock were read, but they are not relied on above.
