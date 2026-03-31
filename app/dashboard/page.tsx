import { readFileSync } from "fs";
import { join } from "path";
import DashboardClient from "./DashboardClient";

export const metadata = { title: "Whale Intel" };

function loadData(version: "v1" | "v2") {
  const base = join(process.cwd(), "public", "data");
  return {
    stats:   JSON.parse(readFileSync(join(base, `${version}_stats.json`),   "utf-8")),
    wallets: JSON.parse(readFileSync(join(base, `${version}_wallets.json`), "utf-8")),
    topTx:   JSON.parse(readFileSync(join(base, `${version}_top_tx.json`),  "utf-8")),
    topNfts: JSON.parse(readFileSync(join(base, `${version}_top_nfts.json`),"utf-8")),
    topUsd:  JSON.parse(readFileSync(join(base, `${version}_top_usd.json`), "utf-8")),
  };
}

export default function DashboardPage() {
  const v1 = loadData("v1");
  const v2 = loadData("v2");
  return <DashboardClient v1={v1} v2={v2} />;
}
