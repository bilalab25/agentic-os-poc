# Deploy a live demo to Render

This deploys the whole stack — **PostgreSQL + FastAPI backend + Next.js frontend**
— from the included `render.yaml` blueprint. Meta Ads stays in **sandbox**, so the
**only secret you need is one Anthropic API key**.

Estimated time: ~15 minutes. Cost: $0 on free plans (see caveats at the end).

## What you need
1. A **GitHub** account (to host the repo Render deploys from).
2. A **Render** account — sign up free at <https://render.com> (use "Sign in with GitHub").
3. An **Anthropic API key** — from <https://console.anthropic.com> → *API Keys*.
   A few dollars of credit is plenty for a demo.
   > 🔐 Do **not** paste this key into chat or commit it. You'll paste it only into
   > Render's encrypted environment settings (Step 3).

---

## Step 1 — Put the code on GitHub
From the `agentic-os-poc` folder (already a git repo):

```bash
# create an EMPTY private repo on github.com first, then:
git remote add origin https://github.com/<you>/agentic-os-poc.git
git push -u origin main
```

## Step 2 — Create the services on Render
1. Render Dashboard → **New +** → **Blueprint**.
2. Connect your GitHub and pick the **agentic-os-poc** repo.
3. Render reads `render.yaml` and shows 3 resources: **agentic-os-db**,
   **agentic-os-backend**, **agentic-os-frontend**. Click **Apply**.
4. Wait for the first build (a few minutes). The backend waits on the database;
   the frontend wires itself to the backend automatically.

## Step 3 — Add your Anthropic key
1. Dashboard → **agentic-os-backend** → **Environment**.
2. Set **`ANTHROPIC_API_KEY`** to your key → **Save changes** (it redeploys).
   *(Skip this and the app still runs — it just uses the flagged mock LLM.)*

## Step 4 — Open it
- Frontend: `https://agentic-os-frontend.onrender.com`
- Backend API docs: `https://agentic-os-backend.onrender.com/docs`

Click through: **Seed leads → Generate email → Generate creative → Approve →
Create campaign → Launch → Insights → Verify chain.**

---

## Verify the deployment
```bash
curl https://agentic-os-backend.onrender.com/health
# {"status":"ok","database":"postgresql","llm_provider":"anthropic", ...}

curl https://agentic-os-backend.onrender.com/audit/verify
# {"valid":true, ...}
```
`database` should read **postgresql** and `llm_provider` **anthropic** once the key
is set.

## Caveats (free plans)
- **Cold starts:** free web services sleep after ~15 min idle and take ~30–60s to
  wake. Upgrade either service to a paid instance to keep it warm for a live demo.
- **Free Postgres expires** after 90 days. Fine for a submission; upgrade for
  anything longer-lived.
- **Region/plan names** occasionally change in Render's UI — if `plan: free` is
  rejected in the blueprint, pick the cheapest option in the dashboard instead.

## Going further (after you win the engagement)
- **Real Meta Ads:** set `META_LIVE=true` and add `META_ACCESS_TOKEN` +
  `META_AD_ACCOUNT_ID` on the backend. Start in the **client's** Meta Business
  account (the brief requires client-owned credentials), with campaigns paused.
- **Real email sending:** add a SendGrid (or SMTP) provider behind a small
  `email_sender` module and a verified sending domain (SPF/DKIM/DMARC).
- **Custom domain + auth:** add the client's domain in Render and put real
  JWT/OAuth2 + RBAC in front (the brief's Layer A).
