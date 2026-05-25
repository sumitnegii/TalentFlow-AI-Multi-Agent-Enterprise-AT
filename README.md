# TalentFlow — AI Multi-Agent Enterprise ATS

An AI-powered Applicant Tracking System that uses a **multi-agent pipeline** to evaluate candidates — not just by their listed skills, but by how they actually used those skills in real projects and work experience.

🔗 **Live Demo**: [talent-flow-ai-multi-agent-enterpri.vercel.app](https://talent-flow-ai-multi-agent-enterpri.vercel.app)

---

## The Problem

Traditional ATS systems do keyword matching — if a resume says "React", it passes. But that tells you nothing about whether the candidate actually built something with React.

Recruiters waste hours manually reading resumes to find this out.

---

## How It Works

Instead of one AI agent giving a final verdict, TalentFlow uses a **multi-agent debate system**:

1. **Skills Agent** — Checks if the candidate has the required skills
2. **Project Agent** — Verifies if those skills were actually used in real projects
3. **Experience Agent** — Evaluates depth of work experience and relevance
4. **HR Agent (Final)** — Reviews all agent outputs, challenges overscoring or underscoring, and gives the final balanced score with reasoning

Each agent's output is passed as context to the next agent — so they're not working in isolation, they're building on each other's analysis.

The HR Agent acts like a senior reviewer in a panel interview — it has the final say.

---

## Why Multi-Agent?

Single agent scoring has one big problem — LLMs can be overconfident. A candidate who lists 10 buzzwords might score higher than someone who quietly built great projects.

By having agents cross-check each other and a final agent play devil's advocate, the system self-corrects and produces more honest, balanced evaluations.

---

## Tech Stack

- **Frontend** — React / TypeScript
- **Backend** — Node.js / JavaScript
- **AI Pipeline** — Multi-agent system using LLM APIs
- **PDF Extraction** — Custom pipeline with fallback handling
- **Deployment** — Vercel

---

## Cost Optimization

- Used **Ollama (local LLM)** during development to avoid burning API tokens while testing agent behavior
- Switched to **GPT-4o-mini** for extraction tasks where a cheaper model was sufficient
- Only used powerful models for final scoring decisions
- Explored AWS SageMaker but decided against it — pay-per-token API was more cost efficient at this scale

---

## Key Features

- Upload candidate resumes (PDF)
- Auto-extract and structure candidate information
- Multi-agent evaluation with transparent reasoning per agent
- Final score with explanation — not a black box
- Raw response logging for debugging and auditing

---

## What I Learned

- How to pass conversation history between agents to maintain context
- How to handle LLM JSON parsing failures gracefully (logging → cleaning → fallback)
- The difference between "has skill" and "used skill" — and why it matters for hiring
- How local LLMs behave differently from API models, especially on structured data extraction

---

## Running Locally

```bash
# Clone the repo
git clone https://github.com/sumitnegii/TalentFlow-AI-Multi-Agent-Enterprise-AT

# Install backend
cd backend
npm install
npm start

# Install frontend
cd frontend
npm install
npm run dev
```

Add your API keys to a `.env` file in the backend folder. #for user who will clone this

---

Built by [Sumit Negi](https://github.com/sumitnegii)
