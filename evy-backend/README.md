# Evy - AI-Powered Support Workflow Engine


This backend provides a robust set of REST APIs for **Lovable** (or any frontend framework) to consume and build a polished, modern dashboard.

## 🌟 The AI Workflow

Judges and developers should note that Evy calls the Oxlo API extensively for different specific tasks. When a ticket arrives, the backend orchestration engine executes a multi-stage AI pipeline:

1. **Classification (Triage)**:
   - Analyzes the ticket subject and body.
   - Outputs structured JSON identifying `intent`, `priority` (e.g., critical vs. low), `sentiment` (e.g., frustrated vs. positive), `escalation_risk`, and a 2-sentence executive `summary`.
2. **Drafting Multi-Tone Replies**:
   - Simultaneously writes 4 completely different draft responses using distinct communication tones (`professional`, `empathetic`, `concise`, `technical`).
3. **Knowledge Base Retrieval (RAG)**:
   - Consults the internal SQLite Knowledge Base to synthesize an accurate, customized answer, citing the specific KB entries used.
4. **Quality Assurance (QA Score)**:
   - Evaluates the primary drafted reply on a scale of 1-10, providing actionable feedback and improvement suggestions before a human ever sees it.
5. **Escalation Handoff Notes**:
   - Generates a highly condensed "Handoff Note" designed for a Tier 2 agent, summarizing the customer's intent, the urgency, and what has already been attempted.
6. **Analytics & Insights**:
   - Ingests multiple tickets to extract overarching operational insights, trend analysis (e.g., declining sentiment), and actionable recommendations for management.

---

## 🛠️ Technical Stack & Architecture

- **Runtime**: Node.js ecosystem (using `tsx` for execution).
- **Language**: TypeScript (100% strict typing, zero `any` types).
- **Web Framework**: Express.js with custom async error handlers.
- **Database**: `better-sqlite3` operating in WAL mode for blazing-fast local performance.
- **Validation**: `Zod` schema validation for all incoming API data.
- **AI Integration**: Official `openai` SDK mapped to the **Oxlo platform API**.
- **Resilience**: Custom retry wrappers handling temporary model timeouts and payload extraction fallbacks to seamlessly decouple markdown formatting from AI outputs.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+)
- An Oxlo.ai API Key (`sk__...`)

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Environment Variables**:
   Create a `.env` file from the example:
   ```env
   OXLO_API_KEY=sk__your_oxlo_api_key
   OXLO_MODEL=ministral-14b
   PORT=8080
   DB_PATH=./supportpilot.db
   ```
3. **Start the Server**:
   ```bash
   npm run dev
   ```
   *Note: On its very first run, the database will automatically initialize its schemas and seed itself with 5 Knowledge Base articles and 3 realistic sample tickets.*

---

## 🌐 API Documentation (For Frontend Consumption)

The server runs on `http://localhost:8080`.

### Health & Usage

#### `GET /health`
Returns the server status to verify connectivity.
**Response**: `{ "status": "ok", "timestamp": 171... }`

#### `GET /api/usage`
Returns a ledger of all AI API calls (for dashboard visibility of tokens and durations).
**Response**:
```json
{
  "usage": [
    { "action": "classify", "model": "ministral-14b", "duration_ms": 3405, "prompt_tokens": 120, "completion_tokens": 80 }
  ]
}
```

### Tickets

#### `GET /api/tickets?status=open&page=1&limit=20`
Get a paginated list of tickets.
**Response**:
```json
{
  "tickets": [
    {
      "id": "uuid",
      "subject": "App crash on login",
      "body": "...",
      "status": "open",
      "created_at": 171...,
      "intent": "bug_report",
      "sentiment": "frustrated",
      "priority": "high",
      "escalation_risk": "medium",
      "analysis_summary": "User reports crash..."
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 20, "pages": 1 }
}
```

#### `GET /api/tickets/:id`
Get full details of a specific ticket, including its timeline of AI analysis, replies, KB answers, and handoff notes.

#### `POST /api/tickets`
Create a new ticket (simulates incoming email/chat).
**Payload**:
```json
{
  "subject": "Refund please",
  "body": "I was double charged.",
  "customer_email": "user@example.com"
}
```

#### `PATCH /api/tickets/:id`
Update a ticket (e.g., closing it).
**Payload**: `{ "status": "resolved" }`

### AI Command Pipeline (The Core Engine)

#### `POST /api/pipeline/:ticketId/run`
**This is the powerhouse endpoint.** Triggers the full parallelized AI workflow for a ticket. If it has already run, it safely returns the cached database results.
**Response**:
```json
{
  "analysis": {
    "intent": "billing_issue",
    "priority": "critical",
    "sentiment": "frustrated",
    "escalation_risk": "high",
    "suggested_category": "Billing",
    "summary": "..."
  },
  "replies": [
    { "tone": "professional", "content": "Dear Customer..." },
    { "tone": "empathetic", "content": "I am so sorry..." },
    { "tone": "concise", "content": "Refund processed." },
    { "tone": "technical", "content": "Transaction ID failed..." }
  ],
  "score": {
    "score": 6,
    "feedback": "Needs more direct action steps.",
    "improvements": ["Add specific timeline"]
  },
  "kb_answer": {
    "answer": "According to our refund policy...",
    "sources": ["kb-uuid-1"]
  },
  "handoff_note": {
    "note": "Urgent P1 escalation: User threatening to cancel over double charge. Reply drafted. Recommend immediate refund."
  }
}
```

#### `POST /api/pipeline/:ticketId/rewrite`
Rewrites an arbitrary text string into a completely new tone using AI.
**Payload**: `{ "reply": "Original text...", "targetTone": "cheerful" }`
**Response**: `{ "rewritten": "New text..." }`

### Analytics & Knowledge Base

#### `GET /api/analytics/stats`
Fast aggregate stats for the dashboard overview.

#### `GET /api/analytics/insights`
*(Cached for 5 minutes to save tokens)*
Queries the AI to provide a high-level operational overview based on recent tickets.
**Response**:
```json
{
  "insights": {
    "top_issues": ["billing_issue", "account_access"],
    "sentiment_trend": "declining",
    "peak_complaint_category": "Account Access",
    "summary": "Urgent failure in reset components noticed..."
  }
}
```

#### `GET /api/knowledge`
Lists all Knowledge Base articles for the internal view.

#### `POST /api/knowledge`
Create a new KB article.

#### `DELETE /api/knowledge/:id`
Delete a KB article.
