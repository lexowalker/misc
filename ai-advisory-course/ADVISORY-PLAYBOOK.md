# Advisory Playbook

Frameworks to use with clients. Start rough and refine them after every real engagement.

---

## 1. Engagement shapes (what you sell)

| Offer | Shape | Typical price | Purpose |
|---|---|---|---|
| **AI Opportunity Assessment** | 3–4 weeks, fixed fee | $10k–$25k | Low-risk entry. Interviews, workflow map, prioritized roadmap, vendor shortlist, risk memo. |
| **Implementation Advisory retainer** | Monthly | $5k–$15k/mo | Ongoing: architecture decisions, vendor selection/negotiation, working with IT, pilot design, evals, training, governance |
| **Pilot build** | 6–10 weeks | Scoped | You + their IT/vendor stand up one workflow with evals and success metrics |
| **HNWI / family office** | Monthly | $5k–$10k/mo | Personal AI setup, privacy-first stack, staff enablement, document vault, research assistant |

The assessment-to-retainer path is the main funnel: the roadmap you write becomes the retainer's work plan.

---

## 2. Discovery questions

**Business**
- Where do your highest-paid people spend time on low-judgment work?
- What decisions are slow because information is hard to find or assemble?
- What would you do with 10 more analysts or associates?
- What's already been tried with AI? What happened? (Learn from the bodies.)

**Workflow-level**, for each candidate workflow
- Volume (per week), time per instance, who does it, and what it costs
- Inputs: where they live (iManage, SharePoint, email, Bloomberg, a data warehouse, PDFs, Excel)
- Output: what "done" looks like, and who checks it
- Cost of an error, and how errors are caught today

**Environment**
- Cloud: Microsoft/Azure, AWS, or Google? M365 tenant? Existing Copilot or ChatGPT licenses?
- Document and data systems, and their APIs/permission models
- IT/security team size and appetite; who owns AI decisions
- Regulatory constraints (SEC/FINRA recordkeeping, GDPR, client confidentiality, privilege, MNPI walls)

**People**
- Who are the champions and who are the skeptics?
- What training exists? What's the policy on personal ChatGPT use? (Shadow AI is almost always already happening.)

---

## 3. Prioritization: Value × Feasibility × Risk

Score each candidate workflow 1–5:

- **Value:** hours saved × cost of those hours, plus quality/speed gains
- **Feasibility:** data accessible? clear definition of correct? can it be evaluated?
- **Risk (inverted):** cost of an error, confidentiality exposure, regulatory exposure

Start with **high value, high feasibility, low-to-moderate risk, with a human
reviewer in the loop.** Quick wins buy trust for the harder projects.

---

## 4. Architecture patterns (the menu)

From simplest to most complex. Recommend the simplest one that works.

1. **Enterprise chat + good habits:** ChatGPT/Claude/Copilot enterprise licenses,
   prompt libraries, training, and a usage policy. Often 60% of the value for 10% of the effort.
2. **Projects/knowledge bases:** curated document sets attached to the enterprise chat tool for a team.
3. **Fixed workflow:** a deterministic pipeline with LLM steps (extract → check → draft → human review).
   Auditable, so it's the default for regulated work.
4. **Retrieval over firm knowledge:** RAG or agentic search over the DMS, with permissions respected.
5. **Agent with tools (MCP):** the model navigates systems, with scoped permissions and human approval for actions.
6. **Coding/general agent harness for power users:** e.g., Claude Code or similar
   for technical staff and quants, with guardrails.

**Build vs. buy:** buy for commodity needs (chat, meeting notes, generic legal
research). Build or configure where the firm's workflow, data, or judgment is the
differentiator. Watch for lock-in: prefer vendors that support multiple models
and open standards (MCP), and that let you export your data and prompts.

---

## 5. Risk & governance checklist

- [ ] **Data flow map:** where data goes, which vendors see it, and in which region
- [ ] **Vendor terms:** no training on client data, retention period (zero-data-retention available?), sub-processors, SOC 2, breach notification
- [ ] **Access control:** AI respects existing permissions; ethical walls/MNPI barriers enforced
- [ ] **Prompt injection:** untrusted content (emails, web, third-party docs) can't trigger actions or exfiltration; no agent combines private data + untrusted input + outbound send without human approval
- [ ] **Human review:** defined for every output that leaves the building or drives a decision
- [ ] **Evals:** baseline accuracy measured before launch; re-run on every model/prompt change
- [ ] **Logging & recordkeeping:** prompts/outputs retained per regulatory requirements; audit trail
- [ ] **Privilege & confidentiality:** legal review of whether AI use affects privilege; engagement-letter disclosure where needed
- [ ] **Acceptable-use policy and training** for staff
- [ ] **Incident plan:** what happens when it gets something wrong
- [ ] **Cost controls:** budgets, alerts, model routing
- [ ] **Exit plan:** can you switch models or vendors without rebuilding?

---

## 6. Success metrics (agree on them before you start)

- Time per task before vs. after (measured, not guessed)
- Accuracy on the eval set, and error rate in production review
- Adoption: weekly active users, tasks run
- Qualitative: user satisfaction, and the things people now do that they couldn't before

---

## 7. Positioning notes

- Your edge: **lawyer-grade rigor + hands-on harness knowledge + experience
  inside a sophisticated hedge fund.** Most AI consultants have one of the three.
- With clients who have strong engineers: be the **systems architect and risk/evals
  lead**, the person who defines "correct," designs the workflow, and owns governance.
- With clients who don't: be the **translator and integrator**. Spec it, pick
  the vendors, work with IT, vibe-code prototypes, and bring in contractors for heavy builds.
- Be honest about what you'd hand to a software engineer. That honesty is part of the premium.
- Check your current engagement contract for non-solicit, non-compete, and
  confidentiality terms before outreach, and never reuse your current client's
  materials as examples.
