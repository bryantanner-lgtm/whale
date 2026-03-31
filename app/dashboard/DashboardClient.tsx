"use client";
import { useState, useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Wallet {
  address: string; short: string; score: number; label: string;
  usd: number; tx12m: number; erc20_12m: number; nft_12m: number;
  nfts: number; collections: number; chains: string; db_chains: number;
  lifetime_tx: number; full: boolean;
  // v2 only
  base_tier?: string; upgraded?: boolean;
}
interface Stats {
  total_wallets: number; full_scored: number; portfolio_only: number;
  total_usd: number; total_tx: number; total_nfts: number;
  avg_score: number; max_score: number; max_tx: number; max_nfts: number;
  tiers: Record<string, number>;
  score_buckets: Record<string, number>;
  usd_buckets: Record<string, number>;
  upgrades?: number; ghost_filtered: number; tier_changes?: number;
  scan_date: string; data_source: string;
  tier_thresholds?: Record<string, string>;
}
interface DataSet { stats: Stats; wallets: Wallet[]; topTx: Wallet[]; topNfts: Wallet[]; topUsd: Wallet[]; }

// ── Config ────────────────────────────────────────────────────────────────────
const TIER: Record<string, { color: string; bg: string; emoji: string; range?: string }> = {
  "Mega whale":        { color:"#f0b429", bg:"rgba(240,180,41,0.13)",  emoji:"🐳", range:"$500K+" },
  "Whale":             { color:"#ff6b35", bg:"rgba(255,107,53,0.13)",  emoji:"🐋", range:"$200K–$500K" },
  "High-value wallet": { color:"#00d4ff", bg:"rgba(0,212,255,0.10)",   emoji:"💎", range:"$51K–$200K" },
  "Mid-tier wallet":   { color:"#a78bfa", bg:"rgba(167,139,250,0.13)", emoji:"📈", range:"$10K–$50K" },
  "Standard wallet":   { color:"#4b5680", bg:"rgba(75,86,128,0.10)",   emoji:"👛", range:"$0–$9,999" },
};
const CHAIN_COLOR: Record<string, string> = {
  eth:"#627EEA", base:"#0052FF", polygon:"#8247E5",
  arbitrum:"#12AAFF", optimism:"#FF0420", bsc:"#F0B90B", avalanche:"#E84142",
};
const TIERS_ORDER = ["Mega whale","Whale","High-value wallet","Mid-tier wallet","Standard wallet"];
const PAGE_SIZE = 50;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt  = (n: number) => n>=1e9?`$${(n/1e9).toFixed(2)}B`:n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1e3?`$${(n/1e3).toFixed(1)}K`:`$${n.toFixed(0)}`;
const fmtN = (n: number) => n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:String(n);

// ── Sub-components ────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r=22, c=2*Math.PI*r;
  const col = score>=70?"#f0b429":score>=50?"#ff6b35":score>=30?"#00d4ff":score>=15?"#a78bfa":"#4b5680";
  return (
    <svg width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4"/>
      <circle cx="26" cy="26" r={r} fill="none" stroke={col} strokeWidth="4"
        strokeDasharray={c} strokeDashoffset={c-(score/100)*c} strokeLinecap="round"
        transform="rotate(-90 26 26)" style={{transition:"stroke-dashoffset 0.8s"}}/>
      <text x="26" y="30" textAnchor="middle" fill={col} fontSize="12" fontWeight="700" fontFamily="monospace">{score}</text>
    </svg>
  );
}

function Bar({ value, max, color="#00d4ff", h=14 }: { value:number; max:number; color?:string; h?:number }) {
  return (
    <div style={{background:"rgba(255,255,255,0.06)",borderRadius:2,height:h,flex:1,overflow:"hidden"}}>
      <div style={{width:`${Math.min(100,(value/(max||1))*100)}%`,height:"100%",background:color,transition:"width 0.6s"}}/>
    </div>
  );
}

function KPI({ label, value, sub, accent }: { label:string; value:string; sub?:string; accent?:string }) {
  return (
    <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 18px"}}>
      <div style={{fontSize:9,color:"var(--dim)",letterSpacing:"0.1em",marginBottom:5}}>{label}</div>
      <div style={{fontSize:22,fontWeight:800,letterSpacing:"-0.5px",color:accent||"var(--bright)",fontFamily:"sans-serif"}}>{value}</div>
      {sub&&<div style={{fontSize:9,color:"var(--dim)",marginTop:3}}>{sub}</div>}
    </div>
  );
}

function Badge({ label, small }: { label:string; small?:boolean }) {
  const cfg = TIER[label]||TIER["Standard wallet"];
  return (
    <span style={{fontSize:small?8:9,fontWeight:700,color:cfg.color,background:cfg.bg,
      padding:small?"1px 5px":"2px 7px",borderRadius:4,whiteSpace:"nowrap"}}>
      {cfg.emoji} {label.replace(" wallet","").replace("High-value","High-val")}
    </span>
  );
}

function AddrLink({ address, short }: { address:string; short:string }) {
  return (
    <a href={`https://etherscan.io/address/${address}`} target="_blank" rel="noopener noreferrer"
      style={{fontFamily:"monospace",fontSize:10,color:"#6b7280",textDecoration:"none"}}
      onMouseEnter={e=>(e.currentTarget.style.color="#00d4ff")}
      onMouseLeave={e=>(e.currentTarget.style.color="#6b7280")}>{short}</a>
  );
}

// ── Version toggle ────────────────────────────────────────────────────────────
function VersionToggle({ version, onChange }: { version:"v1"|"v2"; onChange:(v:"v1"|"v2")=>void }) {
  return (
    <div style={{display:"flex",gap:2,background:"var(--surface)",border:"1px solid var(--border)",
      borderRadius:8,padding:3}}>
      {(["v1","v2"] as const).map(v=>(
        <button key={v} onClick={()=>onChange(v)} style={{
          padding:"5px 14px",borderRadius:6,border:"none",cursor:"pointer",
          background:version===v?"rgba(0,212,255,0.15)":"transparent",
          color:version===v?"#00d4ff":"var(--dim)",
          fontSize:11,fontWeight:version===v?700:400,
          fontFamily:"inherit",transition:"all 0.15s",
        }}>
          {v==="v1"?"v1 — Activity":"v2 — Portfolio"}
        </button>
      ))}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function DashboardClient({ v1, v2 }: { v1: DataSet; v2: DataSet }) {
  const [version, setVersion] = useState<"v1"|"v2">("v2");
  const [tab, setTab]         = useState("🐋 Leaderboard");
  const [sortBy, setSortBy]   = useState("score");
  const [filter, setFilter]   = useState("All");
  const [dataFilter, setDF]   = useState("All");
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(0);

  const d = version === "v1" ? v1 : v2;
  const { stats, wallets, topTx, topNfts, topUsd } = d;
  const { tiers, total_wallets, total_usd, total_tx, total_nfts,
          avg_score, ghost_filtered, scan_date, upgrades } = stats;

  const TABS = ["🐋 Leaderboard", "📊 Analytics", "🛡 Security"];

  const tierDist = TIERS_ORDER.map(t=>({
    label: t.replace(" wallet","").replace("High-value","High-val"),
    emoji: TIER[t].emoji, color: TIER[t].color,
    count: tiers[t]||0, range: TIER[t].range||"",
  }));

  const filtered = useMemo(()=>{
    let d = wallets;
    if(filter!=="All")         d = d.filter(w=>w.label===filter);
    if(dataFilter==="Full")    d = d.filter(w=>w.full);
    if(dataFilter==="Portfolio") d = d.filter(w=>!w.full);
    if(search) d = d.filter(w=>w.address.toLowerCase().includes(search.toLowerCase()));
    return [...d].sort((a,b)=>{
      if(sortBy==="score") return b.score-a.score;
      if(sortBy==="usd")   return b.usd-a.usd;
      if(sortBy==="tx12m") return b.tx12m-a.tx12m;
      if(sortBy==="nfts")  return b.nfts-a.nfts;
      return 0;
    });
  },[wallets,filter,dataFilter,search,sortBy]);

  const paginated  = filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length/PAGE_SIZE);
  const maxTx      = Math.max(...wallets.filter(w=>w.full).map(w=>w.tx12m),1);

  // Reset page when filters/version changes
  const resetPage = () => setPage(0);

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",color:"var(--muted)",fontFamily:"inherit"}}>

      {/* ── HEADER ── */}
      <div style={{borderBottom:"1px solid var(--border)",padding:"0 24px",
        background:"rgba(8,10,14,0.96)",backdropFilter:"blur(12px)",
        position:"sticky",top:0,zIndex:100,
        display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:8,fontSize:17,
            background:"linear-gradient(135deg,#f0b429,#ff6b35)",
            display:"flex",alignItems:"center",justifyContent:"center"}}>🐋</div>
          <div>
            <div style={{fontWeight:800,fontSize:14,color:"var(--bright)",letterSpacing:"-0.4px"}}>
              WHALE INTEL
            </div>
            <div style={{fontSize:8,color:"var(--dim)",letterSpacing:"0.15em"}}>
              ON-CHAIN INTELLIGENCE · DEBANK + MORALIS
            </div>
          </div>
          <span style={{fontSize:8,color:"var(--dim)",background:"var(--surface)",
            border:"1px solid var(--border)",padding:"2px 7px",borderRadius:4}}>INTERNAL</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <VersionToggle version={version} onChange={v=>{setVersion(v);resetPage();}}/>
          <div style={{display:"flex",gap:6}}>
            <span style={{background:"rgba(240,180,41,0.12)",border:"1px solid rgba(240,180,41,0.3)",
              color:"#f0b429",padding:"4px 10px",borderRadius:5,fontSize:10,fontWeight:800}}>
              🐳 {tiers["Mega whale"]||0} MEGA
            </span>
            <span style={{background:"rgba(255,107,53,0.12)",border:"1px solid rgba(255,107,53,0.3)",
              color:"#ff6b35",padding:"4px 10px",borderRadius:5,fontSize:10,fontWeight:800}}>
              🐋 {tiers["Whale"]||0} WHALES
            </span>
          </div>
        </div>
      </div>

      {/* ── VERSION DESCRIPTION BANNER ── */}
      <div style={{background:version==="v2"?"rgba(240,180,41,0.04)":"rgba(0,212,255,0.04)",
        borderBottom:"1px solid var(--border)",padding:"8px 24px",
        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontSize:10,color:"var(--dim)"}}>
          {version==="v1"
            ? "📊 v1 — Activity-weighted scoring: portfolio (60pts max) + TX, ERC20, NFT activity (40pts max). Higher activity → higher tier."
            : "💰 v2 — Portfolio-first scoring: tier set by USD holdings ($0-9K→Standard ... $500K+→Mega). Activity can upgrade 1 tier. Never downgrades."
          }
        </div>
        <div style={{fontSize:9,color:"var(--faint)"}}>
          {scan_date} · {total_wallets.toLocaleString()} wallets
          {upgrades ? ` · ⚡ ${upgrades.toLocaleString()} upgrades` : ""}
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{display:"flex",borderBottom:"1px solid var(--border)",padding:"0 24px"}}>
        {TABS.map(t=>(
          <button key={t} onClick={()=>{setTab(t);resetPage();}} style={{
            padding:"11px 18px",background:"transparent",border:"none",
            borderBottom:tab===t?"2px solid #00d4ff":"2px solid transparent",
            color:tab===t?"#00d4ff":"var(--dim)",fontSize:11,fontWeight:tab===t?700:400,
            fontFamily:"inherit",transition:"all 0.15s"}}>
            {t}
          </button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",
          fontSize:8,color:"var(--faint)",gap:10,paddingRight:4}}>
          <span style={{color:"#ff6b35"}}>⚠ {ghost_filtered} ghost excluded</span>
          <span style={{color:"var(--dim)"}}>{stats.data_source}</span>
        </div>
      </div>

      <div style={{padding:"20px 24px 60px",maxWidth:1440,margin:"0 auto"}}>

        {/* ══ LEADERBOARD ══ */}
        {tab==="🐋 Leaderboard"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>

            {/* KPIs */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
              <KPI label="TOTAL WALLETS" value={total_wallets.toLocaleString()}
                sub={`${stats.full_scored.toLocaleString()} fully scored`}/>
              <KPI label="PORTFOLIO (DEBANK)" value={fmt(total_usd)}
                sub="Spam-filtered · 100+ chains" accent="#f0b429"/>
              <KPI label="12M TRANSACTIONS" value={fmtN(total_tx)} sub="Combined activity"/>
              <KPI label="NFTs HELD" value={fmtN(total_nfts)} sub="Across all wallets"/>
              <KPI label="AVG SCORE" value={avg_score.toString()}
                sub={`Max: ${stats.max_score}`}/>
            </div>

            {/* Tier strip */}
            <div style={{background:"var(--surface)",border:"1px solid var(--border)",
              borderRadius:10,padding:"14px 18px"}}>
              <div style={{fontSize:9,color:"var(--dim)",letterSpacing:"0.1em",marginBottom:10}}>
                TIER DISTRIBUTION — {total_wallets.toLocaleString()} WALLETS
                {version==="v2"&&<span style={{color:"#f0b429",marginLeft:8}}>
                  (portfolio-first · ⚡{upgrades?.toLocaleString()} upgraded by activity)
                </span>}
              </div>
              <div style={{display:"flex",height:22,borderRadius:4,overflow:"hidden",gap:1,marginBottom:10}}>
                {tierDist.map(d=>(
                  <div key={d.label} title={`${d.label}${d.range?" ("+d.range+")":""}: ${d.count}`}
                    onClick={()=>{setFilter(TIERS_ORDER.find(t=>TIER[t].emoji===d.emoji)||"All");resetPage();}}
                    style={{flex:d.count,background:d.color,opacity:0.85,minWidth:d.count?2:0,
                      cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:9,color:"#080a0e",fontWeight:800}}>
                    {d.count>200?d.count.toLocaleString():""}
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                {tierDist.map(d=>(
                  <div key={d.label} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,cursor:"pointer"}}
                    onClick={()=>{setFilter(TIERS_ORDER.find(t=>TIER[t].emoji===d.emoji)||"All");resetPage();}}>
                    <div style={{width:9,height:9,borderRadius:2,background:d.color}}/>
                    <span style={{color:d.color,fontWeight:700}}>{d.emoji} {d.label}</span>
                    <span style={{color:"var(--dim)"}}>({d.count.toLocaleString()})</span>
                    {version==="v2"&&d.range&&<span style={{color:"var(--faint)",fontSize:8}}>{d.range}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Industry context caveat */}
            <div style={{fontSize:9,color:"var(--dim)",padding:"8px 14px",
              background:"rgba(240,180,41,0.04)",border:"1px solid rgba(240,180,41,0.15)",
              borderRadius:6,lineHeight:1.7}}>
              <span style={{color:"#f0b429",fontWeight:700}}>⚠ Dataset-relative tiers: </span>
              Tier classifications are relative to this 14,922-wallet cohort. Mega Whale ($500K+) = top 0.05% of this dataset.
              By broader market standards institutional whales hold $10M+ and Bitcoin whales hold 1,000+ BTC (~$60M).
            </div>

            {/* Controls */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              {["All",...TIERS_ORDER].map(t=>{
                const cfg=t==="All"?null:TIER[t];
                const cnt=t==="All"?total_wallets:tiers[t]||0;
                const active=filter===t;
                return (
                  <button key={t} onClick={()=>{setFilter(t);resetPage();}} style={{
                    padding:"4px 10px",borderRadius:6,border:"1px solid",
                    borderColor:active?(cfg?.color||"#00d4ff"):"var(--border)",
                    background:active?(cfg?.bg||"rgba(0,212,255,0.08)"):"transparent",
                    color:active?(cfg?.color||"#00d4ff"):"var(--dim)",
                    fontSize:10,fontFamily:"inherit",fontWeight:600}}>
                    {t==="All"?"All":t.replace(" wallet","").replace("High-value","High-val")} ({cnt.toLocaleString()})
                  </button>
                );
              })}
              <div style={{width:1,height:18,background:"var(--border)",margin:"0 2px"}}/>
              {[["All","All"],["Full","Full only"],["Portfolio","Port. only"]].map(([v,l])=>(
                <button key={v} onClick={()=>{setDF(v);resetPage();}} style={{
                  padding:"4px 9px",borderRadius:6,border:"1px solid",
                  borderColor:dataFilter===v?"#22c55e":"var(--border)",
                  background:dataFilter===v?"rgba(34,197,94,0.08)":"transparent",
                  color:dataFilter===v?"#22c55e":"var(--dim)",
                  fontSize:9,fontFamily:"inherit"}}>{l}</button>
              ))}
              <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
                {[["score","Score"],["usd","USD"],["tx12m","TX"],["nfts","NFTs"]].map(([k,l])=>(
                  <button key={k} onClick={()=>setSortBy(k)} style={{
                    padding:"3px 8px",borderRadius:4,border:"1px solid",
                    borderColor:sortBy===k?"#00d4ff":"var(--border)",
                    background:sortBy===k?"rgba(0,212,255,0.08)":"transparent",
                    color:sortBy===k?"#00d4ff":"var(--dim)",
                    fontSize:9,fontFamily:"inherit"}}>{l}</button>
                ))}
                <input value={search} onChange={e=>{setSearch(e.target.value);resetPage();}}
                  placeholder="Search address..."
                  style={{padding:"5px 10px",borderRadius:5,border:"1px solid var(--border)",
                    background:"var(--surface)",color:"var(--muted)",fontSize:10,
                    fontFamily:"inherit",outline:"none",width:180}}/>
              </div>
            </div>

            {/* Table */}
            <div style={{overflowX:"auto",border:"1px solid var(--border)",borderRadius:10}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr style={{borderBottom:"1px solid var(--border)",background:"var(--surface)"}}>
                    {["#","Score","Wallet","Tier","Portfolio","TX 12M","ERC20 / NFT","NFTs","Chains","Life TX"].map(h=>(
                      <th key={h} style={{padding:"9px 10px",textAlign:"left",
                        color:"var(--dim)",fontWeight:600,fontSize:9,letterSpacing:"0.06em"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((w,i)=>{
                    const cfg=TIER[w.label]||TIER["Standard wallet"];
                    return (
                      <tr key={w.address}
                        style={{borderBottom:"1px solid rgba(255,255,255,0.03)",transition:"background 0.1s"}}
                        onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.025)")}
                        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                        <td style={{padding:"8px 10px",color:"var(--faint)",fontSize:9}}>{page*PAGE_SIZE+i+1}</td>
                        <td style={{padding:"8px 10px"}}><ScoreRing score={w.score}/></td>
                        <td style={{padding:"8px 10px"}}><AddrLink address={w.address} short={w.short}/></td>
                        <td style={{padding:"8px 10px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:4}}>
                            <Badge label={w.label}/>
                            {version==="v2"&&w.upgraded&&(
                              <span style={{fontSize:7,color:"#22c55e",background:"rgba(34,197,94,0.1)",
                                border:"1px solid rgba(34,197,94,0.25)",padding:"1px 4px",borderRadius:3}}>⚡UP</span>
                            )}
                          </div>
                          {version==="v2"&&w.upgraded&&w.base_tier&&(
                            <div style={{fontSize:7,color:"var(--faint)",marginTop:2}}>
                              from {w.base_tier.replace(" wallet","").replace("High-value","High-val")}
                            </div>
                          )}
                        </td>
                        <td style={{padding:"8px 10px",fontWeight:700,color:"var(--bright)"}}>{fmt(w.usd)}</td>
                        <td style={{padding:"8px 10px",color:w.full?"#9ca3af":"var(--faint)"}}>
                          {w.full?fmtN(w.tx12m):"—"}
                        </td>
                        <td style={{padding:"8px 10px",minWidth:100}}>
                          {w.full?(
                            <>
                              <div style={{display:"flex",gap:2,alignItems:"center"}}>
                                <div style={{height:9,background:"#00d4ff",opacity:0.8,
                                  borderRadius:"2px 0 0 2px",width:`${Math.max(2,(w.erc20_12m/maxTx)*60)}px`}}/>
                                <div style={{height:9,background:"#f0b429",opacity:0.8,
                                  borderRadius:"0 2px 2px 0",width:`${Math.max(2,(w.nft_12m/maxTx)*60)}px`}}/>
                              </div>
                              <div style={{fontSize:8,marginTop:2,display:"flex",gap:5}}>
                                <span style={{color:"#00d4ff"}}>▪{fmtN(w.erc20_12m)}</span>
                                <span style={{color:"#f0b429"}}>▪{fmtN(w.nft_12m)}</span>
                              </div>
                            </>
                          ):<span style={{color:"var(--faint)",fontSize:9}}>—</span>}
                        </td>
                        <td style={{padding:"8px 10px",color:w.full?"#6b7280":"var(--faint)"}}>
                          {w.full?fmtN(w.nfts):"—"}
                        </td>
                        <td style={{padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:"#00d4ff",fontWeight:700}}>{w.db_chains}</div>
                          <div style={{display:"flex",gap:1,flexWrap:"wrap",marginTop:2}}>
                            {w.chains.split(",").filter(Boolean).slice(0,3).map(c=>(
                              <span key={c} style={{fontSize:7,padding:"1px 3px",borderRadius:3,
                                color:CHAIN_COLOR[c]||"var(--dim)",
                                background:`${CHAIN_COLOR[c]||"#555"}18`,
                                border:`1px solid ${CHAIN_COLOR[c]||"#555"}28`}}>{c}</span>
                            ))}
                            {w.db_chains>3&&<span style={{fontSize:7,color:"var(--faint)"}}>+{w.db_chains-3}</span>}
                          </div>
                        </td>
                        <td style={{padding:"8px 10px",color:"var(--faint)",fontSize:9}}>
                          {w.full?fmtN(w.lifetime_tx):"—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length===0&&(
                <div style={{padding:40,textAlign:"center",color:"var(--dim)"}}>No wallets match.</div>
              )}
            </div>

            {totalPages>1&&(
              <div style={{display:"flex",justifyContent:"center",gap:6,alignItems:"center"}}>
                <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}
                  style={{padding:"5px 12px",borderRadius:5,border:"1px solid var(--border)",
                    background:"var(--surface)",color:page===0?"var(--faint)":"#6b7280",
                    cursor:page===0?"not-allowed":"pointer",fontFamily:"inherit",fontSize:10}}>← Prev</button>
                <span style={{fontSize:10,color:"var(--dim)"}}>
                  Page {page+1}/{totalPages} · {filtered.length.toLocaleString()} wallets
                </span>
                <button onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page===totalPages-1}
                  style={{padding:"5px 12px",borderRadius:5,border:"1px solid var(--border)",
                    background:"var(--surface)",color:page===totalPages-1?"var(--faint)":"#6b7280",
                    cursor:page===totalPages-1?"not-allowed":"pointer",fontFamily:"inherit",fontSize:10}}>Next →</button>
              </div>
            )}
          </div>
        )}

        {/* ══ ANALYTICS ══ */}
        {tab==="📊 Analytics"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:18}}>

              {/* Score dist */}
              <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:20}}>
                <div style={{fontSize:9,color:"var(--dim)",letterSpacing:"0.1em",marginBottom:14}}>SCORE DISTRIBUTION</div>
                {[{l:"Mega 70–100",c:"#f0b429",k:"70-100"},{l:"Whale 50–69",c:"#ff6b35",k:"50-69"},
                  {l:"High-val 30–49",c:"#00d4ff",k:"30-49"},{l:"Mid 15–29",c:"#a78bfa",k:"15-29"},
                  {l:"Std 0–14",c:"#4b5680",k:"0-14"}].map(b=>(
                  <div key={b.l} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:9,color:b.c,minWidth:105}}>{b.l}</span>
                    <Bar value={stats.score_buckets[b.k]||0} max={Math.max(...Object.values(stats.score_buckets))} color={b.c}/>
                    <span style={{fontSize:10,fontWeight:700,color:b.c,minWidth:55,textAlign:"right"}}>
                      {(stats.score_buckets[b.k]||0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              {/* USD dist */}
              <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:20}}>
                <div style={{fontSize:9,color:"var(--dim)",letterSpacing:"0.1em",marginBottom:14}}>PORTFOLIO DISTRIBUTION</div>
                {[{l:"$500K+",c:"#f0b429",k:"whale"},{l:"$100K–$500K",c:"#ff6b35",k:"large"},
                  {l:"$10K–$100K",c:"#00d4ff",k:"mid"},{l:"$100–$10K",c:"#a78bfa",k:"small"},
                  {l:"<$100",c:"#4b5680",k:"micro"},{l:"$0",c:"#2a3044",k:"zero"}].map(b=>(
                  <div key={b.l} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:9,color:b.c,minWidth:100}}>{b.l}</span>
                    <Bar value={stats.usd_buckets[b.k]||0} max={Math.max(...Object.values(stats.usd_buckets))} color={b.c}/>
                    <span style={{fontSize:10,fontWeight:700,color:b.c,minWidth:55,textAlign:"right"}}>
                      {(stats.usd_buckets[b.k]||0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Fleet summary */}
              <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:20}}>
                <div style={{fontSize:9,color:"var(--dim)",letterSpacing:"0.1em",marginBottom:14}}>FLEET SUMMARY</div>
                {[
                  {l:"Wallets",        v:total_wallets.toLocaleString(),  c:"var(--bright)"},
                  {l:"Portfolio",      v:fmt(total_usd),                  c:"#f0b429"},
                  {l:"12M TX",         v:fmtN(total_tx),                  c:"#00d4ff"},
                  {l:"NFTs",           v:fmtN(total_nfts),                c:"#f0b429"},
                  {l:"Avg score",      v:avg_score.toString(),            c:"#a78bfa"},
                  {l:"Max score",      v:stats.max_score.toString(),      c:"#f0b429"},
                  {l:"Mega whales",    v:(tiers["Mega whale"]||0).toString(),c:"#f0b429"},
                  {l:"Whales",         v:(tiers["Whale"]||0).toString(),  c:"#ff6b35"},
                  ...(upgrades?[{l:"Activity upgrades",v:upgrades.toLocaleString(),c:"#22c55e"}]:[]),
                  {l:"Ghost filtered", v:"1 ($79.9T)",                    c:"#ff6b35"},
                ].map(r=>(
                  <div key={r.l} style={{display:"flex",justifyContent:"space-between",
                    marginBottom:7,paddingBottom:7,borderBottom:"1px solid var(--border)"}}>
                    <span style={{fontSize:9,color:"#6b7280"}}>{r.l}</span>
                    <span style={{fontSize:10,fontWeight:700,color:r.c}}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 10 */}
            <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:20}}>
              <div style={{fontSize:9,color:"var(--dim)",letterSpacing:"0.1em",marginBottom:14}}>TOP 10 BY SCORE</div>
              {wallets.slice(0,10).map((w,i)=>{
                const cfg=TIER[w.label]||TIER["Standard wallet"];
                const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`;
                return (
                  <div key={w.address} style={{display:"flex",alignItems:"center",gap:12,
                    padding:"9px 14px",background:"var(--bg)",borderRadius:8,marginBottom:4,
                    border:`1px solid ${i<3?cfg.color+"55":"var(--border)"}`}}>
                    <span style={{fontSize:i<3?16:11,minWidth:26,textAlign:"center"}}>{medal}</span>
                    <ScoreRing score={w.score}/>
                    <AddrLink address={w.address} short={w.short}/>
                    <Badge label={w.label}/>
                    {version==="v2"&&w.upgraded&&<span style={{fontSize:7,color:"#22c55e",background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.25)",padding:"1px 4px",borderRadius:3}}>⚡UP</span>}
                    <span style={{fontWeight:800,color:"var(--bright)",minWidth:90,fontSize:12}}>{fmt(w.usd)}</span>
                    <span style={{fontSize:9,color:"var(--dim)",minWidth:60}}>{w.db_chains} chains</span>
                    <div style={{flex:1}}><Bar value={w.tx12m} max={wallets[0]?.tx12m||1} color={cfg.color}/></div>
                    <span style={{fontSize:9,color:"#6b7280",minWidth:55}}>{w.full?fmtN(w.tx12m)+" tx":"—"}</span>
                  </div>
                );
              })}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
              <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:20}}>
                <div style={{fontSize:9,color:"var(--dim)",letterSpacing:"0.1em",marginBottom:14}}>MOST ACTIVE — TX 12M</div>
                {topTx.map((w,i)=>(
                  <div key={w.address} style={{display:"flex",alignItems:"center",gap:10,marginBottom:7}}>
                    <span style={{fontSize:9,color:"var(--faint)",minWidth:16}}>{i+1}</span>
                    <AddrLink address={w.address} short={w.short}/>
                    <Bar value={w.tx12m} max={topTx[0]?.tx12m||1} color="#00d4ff"/>
                    <span style={{fontSize:9,fontWeight:700,color:"#00d4ff",minWidth:50,textAlign:"right"}}>{fmtN(w.tx12m)}</span>
                  </div>
                ))}
              </div>
              <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:20}}>
                <div style={{fontSize:9,color:"var(--dim)",letterSpacing:"0.1em",marginBottom:14}}>TOP NFT HOLDERS</div>
                {topNfts.map((w,i)=>(
                  <div key={w.address} style={{display:"flex",alignItems:"center",gap:10,marginBottom:7}}>
                    <span style={{fontSize:9,color:"var(--faint)",minWidth:16}}>{i+1}</span>
                    <AddrLink address={w.address} short={w.short}/>
                    <Bar value={w.nfts} max={topNfts[0]?.nfts||1} color="#f0b429"/>
                    <span style={{fontSize:9,fontWeight:700,color:"#f0b429",minWidth:50,textAlign:"right"}}>{fmtN(w.nfts)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ SECURITY ══ */}
        {tab==="🛡 Security"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
              <KPI label="👻 GHOST BALANCE" value="1 wallet"
                sub="0xf39F $79.9T — excluded" accent="#ff4444"/>
              <KPI label="PREFLIGHT FILTERED" value="10,145"
                sub="68% inactive — excluded before scan" accent="#f0b429"/>
              <KPI label="DEBANK VALIDATED" value="14,922"
                sub="0 errors · 0 ghost balances" accent="#22c55e"/>
              <KPI label="⚖️ GDPR" value="Review"
                sub="Pseudonymous PII — Art. 4(1)" accent="#a78bfa"/>
            </div>
            <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:20}}>
              <div style={{fontSize:9,color:"var(--dim)",letterSpacing:"0.1em",marginBottom:14}}>PORTFOLIO CONCENTRATION — TOP 10</div>
              {topUsd.map((w,i)=>{
                const pct=w.usd/total_usd*100;
                const cfg=TIER[w.label]||TIER["Standard wallet"];
                return (
                  <div key={w.address} style={{display:"flex",alignItems:"center",gap:12,marginBottom:7}}>
                    <span style={{fontSize:9,color:"var(--faint)",minWidth:16}}>{i+1}</span>
                    <AddrLink address={w.address} short={w.short}/>
                    <Badge label={w.label} small/>
                    <Bar value={w.usd} max={topUsd[0]?.usd||1} color={cfg.color}/>
                    <span style={{fontSize:10,fontWeight:700,color:"var(--bright)",minWidth:80,textAlign:"right"}}>{fmt(w.usd)}</span>
                    <span style={{fontSize:9,minWidth:42,textAlign:"right",
                      color:pct>20?"#ff4444":pct>10?"#f0b429":"var(--faint)"}}>{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[
                {icon:"🔍",color:"#ff4444",title:"Unicode Phishing Tokens",
                  body:"Multiple wallets received Cyrillic/Lisu lookalike tokens impersonating ETH and USDC. DeBank filters these automatically. Do not interact with unverified contracts from unknown senders."},
                {icon:"⚖️",color:"#a78bfa",title:"GDPR — Pseudonymous PII",
                  body:"Wallet addresses are pseudonymous personal data under GDPR Art. 4(1). Establish lawful basis, apply data minimisation, strip raw JSON before external sharing, enforce retention policy."},
                {icon:"🔒",color:"#22c55e",title:"API Key Security",
                  body:"API keys must be stored as environment variables only. One DeBank key was exposed during this session and revoked. Never paste keys into chat or hardcode in scripts."},
                {icon:"📋",color:"#00d4ff",title:"Data Completeness",
                  body:"Activity data covers ETH + 6 chains via Moralis. Wallets are active on 18.9 chains on average per DeBank. Full multi-chain activity scanning would require expanding beyond 7 chains."},
              ].map(r=>(
                <div key={r.title} style={{padding:"14px 16px",background:"var(--bg)",
                  borderRadius:8,border:"1px solid var(--border)"}}>
                  <div style={{display:"flex",gap:8,marginBottom:7,alignItems:"center"}}>
                    <span>{r.icon}</span>
                    <span style={{fontSize:10,fontWeight:700,color:r.color}}>{r.title}</span>
                  </div>
                  <div style={{fontSize:10,color:"#6b7280",lineHeight:1.65}}>{r.body}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{padding:"12px 24px 20px",borderTop:"1px solid var(--border)",
        display:"flex",justifyContent:"space-between",fontSize:8,color:"var(--faint)"}}>
        <span>DeBank Pro (portfolio · 14,922) + Moralis Pro (activity · 4,777) · {scan_date} · 1 ghost excluded</span>
        <span>⚠ Pseudonymous wallet data — GDPR Art. 4(1) · Internal use only</span>
      </div>
    </div>
  );
}
