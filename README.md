# Whale Intel Dashboard

On-chain wallet intelligence dashboard with v1 (activity-weighted) and v2 (portfolio-first) scoring models.

## Deploy to Vercel (5 minutes)

### Option 1 — Vercel CLI (recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to this folder
cd whale-intel-dashboard

# Deploy
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: whale-intel (or any name)
# - Directory: ./
# - Override settings? No
```

### Option 2 — Vercel Dashboard (no CLI needed)
1. Zip this entire folder
2. Go to vercel.com → New Project → Import
3. Drag and drop the zip
4. Click Deploy — no environment variables needed

### Option 3 — GitHub
```bash
git init
git add .
git commit -m "Initial deploy"
git remote add origin https://github.com/YOUR_USERNAME/whale-intel.git
git push -u origin main
# Then import the GitHub repo in Vercel dashboard
```

## Local development
```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Data refresh
The dashboard serves wallet data from static JSON files in `/public/data/`.
To update with new scan results:
1. Replace the JSON files in `/public/data/`
2. Re-deploy: `vercel --prod`

## Architecture
- **Next.js 14** — App Router, static generation
- **No database** — all data served as static JSON from `/public/data/`
- **No env vars required** — fully self-contained

## Files
```
public/data/
  v1_stats.json        ← v1 fleet statistics
  v1_wallets.json      ← v1 scored wallets (4,777)
  v1_top_tx.json       ← v1 most active wallets
  v1_top_nfts.json     ← v1 top NFT holders
  v1_top_usd.json      ← v1 top by portfolio
  v2_stats.json        ← v2 fleet statistics
  v2_wallets.json      ← v2 scored wallets (4,777)
  v2_top_tx.json       ← v2 most active wallets
  v2_top_nfts.json     ← v2 top NFT holders
  v2_top_usd.json      ← v2 top by portfolio

app/
  dashboard/
    page.tsx           ← server component (loads JSON)
    DashboardClient.tsx ← interactive UI with v1/v2 toggle
```
