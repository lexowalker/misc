# Curriculum: 12 Weeks

Each week has a **goal**, **inputs** (watch/read), **outputs** (build/write),
and a **done-when** check. The outputs are what count; skip any input you
already understand.

> A note on freshness: the model landscape changes monthly. Resources here were
> chosen because they stay useful. For anything about *which model is best right
> now*, check the live sources listed in Week 4 instead of trusting any static
> list, this one included.

---

## Phase 1: How it actually works (Weeks 1–3)

**Phase goal:** be able to explain, at a whiteboard with no slides, what happens
between "user types a prompt" and "model returns text," and why that explains
the behaviors clients run into: hallucination, context limits, cost, and
non-determinism.

### On linear algebra: how much you need

Less than 3Blue1Brown's aside implies. You need **intuition**, not computation:

- A vector is a list of numbers that represents a point or direction in space.
  Words become vectors (embeddings), and "similar meaning" means "nearby."
- A matrix is a function that transforms vectors. A neural network layer is
  basically "multiply by a matrix, then apply a squiggle."
- A dot product measures how aligned two vectors are. Attention is "dot products
  to decide what each word should pay attention to."

That's the core of it. Watch **3Blue1Brown, *Essence of Linear Algebra***,
chapters 1–4, 9 (dot products), and optionally 7 (inverse) and 14 (eigen),
at 1.5× speed. Do **not** take a full linear algebra course; it's poor ROI for
your goals. Your ChemE background (matrices in mass balances, numerical methods,
optimization) already gives you the instincts.

### Week 1: Neural nets and training

- **Inputs**
  - 3Blue1Brown *Neural Networks* ch. 1–4 (you're on this already)
  - 3Blue1Brown *Essence of Linear Algebra*, the chapters above
- **The key ideas to own**
  - A model is a giant parameterized function, and training is optimization
    (gradient descent is just a hill-descending algorithm you've seen in ChemE)
  - Loss function, gradient, and backprop at the level of "what" and "why," not the calculus
  - Overfitting and generalization
- **Outputs**
  - A one-page "explain it to a portfolio manager" note in `JOURNAL.md`
  - Lab 0 (environment setup)
- **Done when:** you can explain gradient descent with a non-math analogy in under 60 seconds

### Week 2: Transformers and LLMs

- **Inputs**
  - 3Blue1Brown *Neural Networks* ch. 5–7 (GPT, attention, MLPs/how facts are stored)
  - Andrej Karpathy, *Intro to Large Language Models* (1-hour talk, YouTube)
  - Jay Alammar, *The Illustrated Transformer* (blog), skimming as a visual reference
- **The key ideas to own**
  - **Tokens**: models see chunks, not characters or words. This is why
    counting letters is hard and why pricing is per token.
  - **Next-token prediction**: everything is autocomplete, sampled one token at a time
  - **Context window**: the model's entire working memory for a request. It
    remembers nothing between calls unless *you* put it back in. This is the
    single most important fact for harness design.
  - **Temperature/sampling**: why the same prompt gives different answers
  - **Attention**: each token looks at all prior tokens, which is why long contexts are expensive
- **Outputs**
  - Lab 1 (first API calls; play with temperature, token counts, context limits)
- **Done when:** you can explain why a model "hallucinates" a case citation in
  terms of next-token prediction, and why retrieval reduces (but doesn't eliminate) it

### Week 3: From base model to assistant to agent

- **Inputs**
  - Karpathy, *Deep Dive into LLMs like ChatGPT* (3.5h; watch the post-training
    and "LLM psychology" sections closely, skim the rest)
  - Anthropic, *Building Effective Agents* (blog post, Dec 2024). This is required
    reading and you'll re-read it in Week 5.
  - Optional for the deeply curious: Karpathy *Let's build GPT from scratch*.
    Watch it, don't code along. Seeing a GPT built in ~200 lines demystifies it.
- **The key ideas to own**
  - **Pre-training** (read the internet, learn to predict text), then
    **post-training** (supervised fine-tuning + RL from human/AI feedback to make
    it helpful, honest, and harmless), then **reasoning/thinking models** (RL on
    verifiable tasks, so the model learns to "think" before answering)
  - **Tool use**: the model doesn't *do* anything itself. It outputs a structured
    request ("call search with X"), *your code* runs it, and the result goes back
    into context. **An agent is just this in a loop.**
  - Why **fine-tuning is rarely the answer** for your clients: it's expensive and
    brittle, frontier models improve faster than your fine-tune, and most
    problems are actually context, data-access, or workflow problems
- **Outputs**
  - Lab 2 (build a tiny agent loop by hand, about 60 lines with your AI coding agent's help)
  - Journal: "Five things executives misunderstand about LLMs." This is your first outreach post.
- **Done when:** you can draw the agent loop (model → tool call → your code →
  result → model …) on a napkin and point to where things go wrong

---

## Phase 2: The ecosystem (Week 4, then ongoing)

### Week 4: Models, vendors, and how to choose

- **The map to build** (make it a living doc and update it monthly; it becomes a client deliverable)
  - **Frontier labs and model families:** Anthropic (Claude), OpenAI (GPT/o-series),
    Google (Gemini), xAI (Grok), plus open-weight models (Meta Llama, Mistral, DeepSeek, Qwen)
  - **Axes that matter to clients:** capability on *their* task, speed and latency,
    cost per million tokens, context length, multimodal input (PDFs, images,
    audio), tool use and agentic reliability, data retention and training
    policies, deployment options (vendor API vs. AWS Bedrock / Azure / Google Vertex
    vs. self-hosted open weights), and enterprise contract terms
  - **The "where does it run" question**, which is huge for funds: a vendor API
    with zero-data-retention terms, inside the client's own cloud tenant
    (Bedrock/Azure/Vertex), or on-prem open-weight. Know the trade-offs cold.
  - **Application layer:** ChatGPT Enterprise, Claude for Enterprise, Microsoft
    Copilot, Gemini for Workspace; legal-specific tools (Harvey, Legora, CoCounsel,
    and others); finance-specific tools; coding agents (Claude Code, Codex, Cursor)
  - **Plumbing:** document management (iManage, NetDocuments, SharePoint),
    vector databases, orchestration frameworks, MCP servers, observability and
    eval tools
- **Live sources** (check these instead of trusting memory)
  - LMArena (crowd rankings), Artificial Analysis (price, speed, and benchmarks),
    vendors' own model cards and pricing pages
  - Epoch AI and METR for trend data, which is useful for "where is this going" client conversations
  - Simon Willison's blog (simonwillison.net), the single best practitioner feed
  - Pick 2–3 newsletters or podcasts and cap them at 2 hours/week. Information
    diet discipline matters; the firehose is endless.
- **Outputs**
  - Lab 3 (model bake-off on one of *your* real legal tasks)
  - `model-landscape.md` in your own notes: your opinionated one-pager
- **Done when:** given a client scenario ("fund wants AI over research notes, no
  data leaves Azure"), you can name 2–3 viable stacks and their trade-offs in 5 minutes

---

## Phase 3: Harness engineering (Weeks 5–9) — the core

**Phase goal:** understand and build the systems around the model. A *harness*
is everything that isn't the model: the system prompt, the tools, how context is
assembled, memory, the loop, permissions, guardrails, logging, and evals. The
same model can be useless or superb depending on its harness. This is the
highest-leverage thing you can advise on.

You will "vibe code" with an AI coding agent, but **read every file it writes
and ask it to explain anything you don't follow.** Your goal isn't to become a
software engineer. It's to be able to *specify, evaluate, and debug* systems,
and to talk credibly with clients' engineers.

### Week 5: Prompting and context engineering

- **Inputs**
  - Anthropic prompt engineering docs (docs.anthropic.com); OpenAI prompting guide
  - Re-read *Building Effective Agents*, then Anthropic's posts on context
    engineering and on writing tools for agents
- **The key ideas to own**
  - **Context engineering > prompt engineering.** The question is "what does
    the model need in its window, in what form, at what moment?"
  - System prompts, examples (few-shot), structured outputs (JSON schemas),
    and asking the model to reason before answering
  - Writing prompts like you'd brief a smart new associate who has zero
    context. Your lawyer skills transfer directly here.
- **Outputs:** Lab 4 (a prompt-engineered contract clause extractor with structured output)

### Week 6: Retrieval (RAG) and getting at client data

- **The key ideas to own**
  - Embeddings and semantic search (here's where the vector intuition from Week 1 pays off)
  - Chunking, hybrid search (keywords + semantic), re-ranking, and metadata
    filters (matter, date, client, *permissions*)
  - **Agentic search vs. classic RAG:** modern agents often do better by
    searching and reading files directly with tools (grep, list, open) than by
    relying on a pre-built vector index. Know when each fits.
  - **Permissions are the hard part in the enterprise.** If the analyst can't
    see a document in SharePoint/iManage, the AI must not either. Ethical walls
    and information barriers matter at funds and firms.
- **Outputs:** Lab 5 (Q&A over a folder of documents, with citations, built two ways)

### Week 7: Tools, MCP, and agents

- **The key ideas to own**
  - **MCP (Model Context Protocol):** the open standard for plugging tools and
    data sources into AI apps. Think "USB-C for AI." Clients will ask about it,
    and vendors increasingly ship MCP servers (for doc management, CRMs, databases).
  - **Workflow vs. agent:** fixed steps (predictable, auditable) vs. model-directed
    loops (flexible, less predictable). For regulated clients, start with workflows.
  - **Agent SDKs and coding agents as general-purpose harnesses.** The Claude
    Agent SDK, OpenAI Agents SDK, and the realization that tools like Claude Code
    are general agent harnesses, usable for far more than code.
  - Subagents, skills, and memory files: patterns for long or complex tasks
- **Outputs:** Lab 6 (an agent with MCP tools over a mock document system)

### Week 8: Evals, which is your secret weapon

- **Inputs:** Hamel Husain's writing on evals (hamel.dev); Eugene Yan (eugeneyan.com)
- **The key ideas to own**
  - "It looked good in the demo" is how AI projects die. **Evals are tests:** a
    set of real inputs with known-good answers or grading criteria, run every
    time something changes (prompt, model, tool).
  - Error analysis first: read 50–100 real outputs, categorize the failures, *then* write evals
  - Code-based checks, LLM-as-judge (and how to validate the judge against human
    labels), and human review queues
  - This is where lawyer-mindedness shines: you're already trained to define
    "correct," spot edge cases, and audit work product
- **Outputs:** Lab 7 (an eval suite for your Lab 4/5 systems; use it to compare 3 models and 2 prompts)

### Week 9: Production concerns: security, cost, governance

- **The key ideas to own**
  - **Prompt injection:** documents, emails, and web pages can contain
    instructions the model may follow. Pay special attention to the "lethal
    trifecta" (Simon Willison's term): private data + untrusted content + the
    ability to send data out. Design so no single agent has all three.
  - Data governance: retention, zero-data-retention agreements, training opt-outs,
    privilege and confidentiality, regulatory recordkeeping (SEC/FINRA for funds),
    audit logs
  - Cost modeling: tokens × price × volume, prompt caching, model routing (cheap
    model for easy steps). Build a spreadsheet you can reuse with clients.
  - Observability: logging every model call and tool call so failures can be investigated
  - Human-in-the-loop design: who approves what, and when
- **Outputs:** the risk checklist in `ADVISORY-PLAYBOOK.md`, personalized; a cost-model template

---

## Phase 4: Advisory craft and capstone (Weeks 10–12)

### Week 10: Discovery and solution design

- Work through `ADVISORY-PLAYBOOK.md`
- Run a mock discovery session. Have a model role-play a skeptical COO of a
  $2B fund, then a family-office principal.
- **Output:** a template "AI Opportunity Assessment" deliverable (10–15 pages)
  you can sell as a fixed-fee entry engagement

### Weeks 11–12: Capstone

- **Lab 8:** build one polished, client-grade demo harness end to end
  (spec → build → evals → risk memo → 5-minute demo video). This becomes your
  portfolio piece and outreach asset.
- Write it up as a case study for your website.

---

## After week 12: staying sharp (about 3 hrs/week)

- Monthly: update your model landscape doc and re-run your eval suites on new models.
  "Here's how the new model does on *tasks like yours*" is a great retainer touchpoint.
- Weekly: one small build or experiment, one journal entry (= one post)
- Read release notes from the major labs and your clients' key vendors
- Go deeper wherever client demand pulls you (e.g., Excel/financial modeling
  agents, voice, document automation, Microsoft 365 integration)
