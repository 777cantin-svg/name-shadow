import { useState, useEffect, useCallback, useRef } from "react";

// ── Mock Data ──────────────────────────────────────────────────────────────
const EXCHANGES = ["bitFlyer", "Coincheck", "GMOコイン", "bitbank", "SBI VC"];
const COINS = ["BTC", "ETH", "XRP", "SOL", "BCH", "LTC", "DOGE"];

const FEES = {
  bitFlyer:  { taker: 0.0015, withdrawal: { BTC: 0.0004, ETH: 0.005, XRP: 0.15,  SOL: 0.01, BCH: 0.001, LTC: 0.001, DOGE: 5 } },
  Coincheck: { taker: 0.0000, withdrawal: { BTC: 0.0005, ETH: 0.005, XRP: 0.15,  SOL: 0.01, BCH: 0.001, LTC: 0.001, DOGE: 5 } },
  GMOコイン:  { taker: 0.0005, withdrawal: { BTC: 0.0000, ETH: 0.000, XRP: 0.00,  SOL: 0.00, BCH: 0.000, LTC: 0.000, DOGE: 0 } },
  bitbank:   { taker: 0.0012, withdrawal: { BTC: 0.0006, ETH: 0.005, XRP: 0.15,  SOL: 0.01, BCH: 0.001, LTC: 0.001, DOGE: 5 } },
  "SBI VC":  { taker: 0.0000, withdrawal: { BTC: 0.0005, ETH: 0.005, XRP: 0.15,  SOL: 0.01, BCH: 0.001, LTC: 0.001, DOGE: 5 } },
};

const BASE_PRICES = { BTC: 13200000, ETH: 620000, XRP: 380, SOL: 28000, BCH: 78000, LTC: 16500, DOGE: 55 };
const SPREAD_RATES = { bitFlyer: 0.008, Coincheck: 0.012, GMOコイン: 0.003, bitbank: 0.002, "SBI VC": 0.004 };

function generatePrices() {
  const prices = {};
  COINS.forEach(coin => {
    prices[coin] = {};
    EXCHANGES.forEach(ex => {
      const base = BASE_PRICES[coin];
      const noise = (Math.random() - 0.49) * base * 0.025;
      const mid = base + noise;
      const spread = SPREAD_RATES[ex];
      prices[coin][ex] = {
        mid: Math.round(mid),
        buy: Math.round(mid * (1 + spread / 2)),
        sell: Math.round(mid * (1 - spread / 2)),
        spread: Math.round(mid * spread),
        spreadPct: (spread * 100).toFixed(2),
        volume: Math.round(Math.random() * 500 + 50),
        change24h: ((Math.random() - 0.5) * 8).toFixed(2),
      };
    });
  });
  return prices;
}

function calcArbitrage(prices) {
  const opps = [];
  COINS.forEach(coin => {
    const exData = prices[coin];
    for (let i = 0; i < EXCHANGES.length; i++) {
      for (let j = 0; j < EXCHANGES.length; j++) {
        if (i === j) continue;
        const buyEx = EXCHANGES[i];
        const sellEx = EXCHANGES[j];
        const buyPrice = exData[buyEx].buy;
        const sellPrice = exData[sellEx].sell;
        if (sellPrice <= buyPrice) continue;

        const rawDiff = sellPrice - buyPrice;
        const qty = Math.min(1, 500000 / buyPrice);
        const buyFee = buyPrice * qty * FEES[buyEx].taker;
        const sellFee = sellPrice * qty * FEES[sellEx].taker;
        const wdFee = (FEES[buyEx].withdrawal[coin] || 0) * buyPrice;
        const slippage = rawDiff * qty * 0.15;
        const totalCost = buyFee + sellFee + wdFee + slippage;
        const grossProfit = rawDiff * qty;
        const netProfit = Math.round(grossProfit - totalCost);
        const profitRate = ((netProfit / (buyPrice * qty)) * 100).toFixed(3);
        const rawRate = ((rawDiff / buyPrice) * 100).toFixed(2);

        let rank, rankColor;
        if (netProfit > 15000 && parseFloat(profitRate) > 0.5) { rank = "S"; rankColor = "#00ff9d"; }
        else if (netProfit > 5000 && parseFloat(profitRate) > 0.2) { rank = "A"; rankColor = "#39ff14"; }
        else if (netProfit > 0 && parseFloat(profitRate) > 0.05) { rank = "B"; rankColor = "#ffd700"; }
        else if (netProfit > -2000) { rank = "C"; rankColor = "#ff8c00"; }
        else { rank = "D"; rankColor = "#ff3131"; }

        const warnings = [];
        if (parseFloat(exData[buyEx].spreadPct) > 0.8) warnings.push("スプレッド広大");
        if (exData[buyEx].volume < 100) warnings.push("板が薄い");
        if (rawDiff / buyPrice < 0.005) warnings.push("差額わずか");
        if (wdFee > 1000) warnings.push("送金コスト高");

        opps.push({
          id: `${coin}-${buyEx}-${sellEx}`,
          coin, buyEx, sellEx, buyPrice, sellPrice,
          rawDiff: Math.round(rawDiff),
          rawRate,
          netProfit,
          profitRate,
          totalCost: Math.round(totalCost),
          rank, rankColor,
          warnings,
          isTrap: rank === "D" || (warnings.length >= 2 && netProfit < 0),
          spreadBuy: exData[buyEx].spreadPct,
          spreadSell: exData[sellEx].spreadPct,
          volume: exData[buyEx].volume,
          buyFee: Math.round(buyFee),
          sellFee: Math.round(sellFee),
          wdFee: Math.round(wdFee),
          slippage: Math.round(slippage),
        });
      }
    }
  });
  return opps.sort((a, b) => b.netProfit - a.netProfit);
}

// ── Sub Components ──────────────────────────────────────────────────────────
function RankBadge({ rank, color }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 28, height: 28, borderRadius: 6,
      background: `${color}22`, border: `1.5px solid ${color}`,
      color, fontFamily: "'Rajdhani', monospace", fontSize: 14, fontWeight: 700,
      boxShadow: `0 0 8px ${color}55`,
    }}>{rank}</span>
  );
}

function CoinTag({ coin }) {
  const colors = { BTC: "#f7931a", ETH: "#627eea", XRP: "#346aa9", SOL: "#9945ff", BCH: "#8dc351", LTC: "#bfbbbb", DOGE: "#c2a633" };
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 4,
      background: `${colors[coin] || "#888"}22`,
      border: `1px solid ${colors[coin] || "#888"}66`,
      color: colors[coin] || "#aaa",
      fontSize: 11, fontWeight: 700, fontFamily: "monospace", letterSpacing: 1,
    }}>{coin}</span>
  );
}

function PulsingDot({ color = "#00ff9d" }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: 8, height: 8 }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: color, animation: "pulse 1.5s infinite",
      }} />
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: color, opacity: 0.3, animation: "pulseRing 1.5s infinite",
        transform: "scale(2.5)",
      }} />
    </span>
  );
}

function StatCard({ label, value, sub, color = "#00ff9d", icon }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)",
      border: `1px solid ${color}33`, borderRadius: 12,
      padding: "16px 20px", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: 60, height: 60,
        background: `radial-gradient(circle at top right, ${color}22, transparent 70%)`,
      }} />
      <div style={{ fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontFamily: "'Rajdhani', monospace", color, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function OpportunityCard({ opp, onClick, isSelected }) {
  const isPositive = opp.netProfit > 0;
  const nColor = isPositive ? "#00ff9d" : "#ff3131";

  return (
    <div
      onClick={() => onClick(opp)}
      style={{
        background: isSelected
          ? "linear-gradient(135deg, #0f2a1e 0%, #111 100%)"
          : "linear-gradient(135deg, #0d1117 0%, #13181f 100%)",
        border: `1px solid ${isSelected ? opp.rankColor : "#1e2530"}`,
        borderRadius: 12, padding: "14px 16px",
        cursor: "pointer", transition: "all 0.2s",
        boxShadow: isSelected ? `0 0 20px ${opp.rankColor}33` : "none",
        position: "relative", overflow: "hidden",
      }}
    >
      {opp.isTrap && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          fontSize: 10, color: "#ff3131", border: "1px solid #ff313155",
          borderRadius: 4, padding: "1px 6px", background: "#ff313111",
        }}>⚠ 罠</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <RankBadge rank={opp.rank} color={opp.rankColor} />
        <CoinTag coin={opp.coin} />
        <div style={{ flex: 1, fontSize: 12, color: "#888" }}>
          {opp.buyEx} <span style={{ color: "#444" }}>→</span> {opp.sellEx}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>表面差額</div>
          <div style={{ fontSize: 14, color: "#aaa", fontFamily: "monospace" }}>
            ¥{opp.rawDiff.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: "#666" }}>{opp.rawRate}%</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>総コスト</div>
          <div style={{ fontSize: 14, color: "#ff8c00", fontFamily: "monospace" }}>
            ¥{opp.totalCost.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>純利益</div>
          <div style={{ fontSize: 16, color: nColor, fontFamily: "'Rajdhani', monospace", fontWeight: 700 }}>
            ¥{opp.netProfit.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: nColor + "aa" }}>{opp.profitRate}%</div>
        </div>
      </div>

      {opp.warnings.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 10 }}>
          {opp.warnings.map(w => (
            <span key={w} style={{
              fontSize: 9, color: "#ff8c00", border: "1px solid #ff8c0044",
              borderRadius: 3, padding: "1px 5px", background: "#ff8c0011",
            }}>{w}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailPanel({ opp, onClose }) {
  if (!opp) return null;
  const isPositive = opp.netProfit > 0;
  const nColor = isPositive ? "#00ff9d" : "#ff3131";
  const items = [
    { label: "買い手数料", value: opp.buyFee, color: "#ff8c00" },
    { label: "売り手数料", value: opp.sellFee, color: "#ff8c00" },
    { label: "出金・送金コスト", value: opp.wdFee, color: "#ff8c00" },
    { label: "想定スリッページ", value: opp.slippage, color: "#ffd700" },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      animation: "fadeIn 0.15s ease",
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: "linear-gradient(180deg, #0d1117 0%, #090d12 100%)",
          border: "1px solid #1e2530", borderRadius: "20px 20px 0 0",
          padding: "20px 20px 36px",
          animation: "slideUp 0.25s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <RankBadge rank={opp.rank} color={opp.rankColor} />
          <CoinTag coin={opp.coin} />
          <span style={{ fontSize: 13, color: "#777", flex: 1 }}>詳細分析</span>
          <button onClick={onClose} style={{
            background: "#1e2530", border: "none", color: "#888",
            width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 14,
          }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div style={{ background: "#0a1520", border: "1px solid #1e3040", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, color: "#445", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>買い取引所</div>
            <div style={{ fontSize: 13, color: "#aaa", fontWeight: 600 }}>{opp.buyEx}</div>
            <div style={{ fontSize: 18, color: "#fff", fontFamily: "monospace", marginTop: 2 }}>¥{opp.buyPrice.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: "#445", marginTop: 4 }}>スプレッド {opp.spreadBuy}%</div>
          </div>
          <div style={{ background: "#0a2015", border: "1px solid #1e4030", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, color: "#445", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>売り取引所</div>
            <div style={{ fontSize: 13, color: "#aaa", fontWeight: 600 }}>{opp.sellEx}</div>
            <div style={{ fontSize: 18, color: "#00ff9d", fontFamily: "monospace", marginTop: 2 }}>¥{opp.sellPrice.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: "#445", marginTop: 4 }}>スプレッド {opp.spreadSell}%</div>
          </div>
        </div>

        <div style={{ background: "#0d1117", border: "1px solid #1e2530", borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 10, letterSpacing: 1 }}>コスト内訳</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "#888" }}>表面差額</span>
            <span style={{ fontSize: 14, color: "#ccc", fontFamily: "monospace" }}>+¥{opp.rawDiff.toLocaleString()}</span>
          </div>
          {items.map(item => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: "#555" }}>　{item.label}</span>
              <span style={{ fontSize: 12, color: item.color, fontFamily: "monospace" }}>-¥{item.value.toLocaleString()}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #1e2530", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "#aaa", fontWeight: 600 }}>純利益</span>
            <span style={{ fontSize: 20, color: nColor, fontFamily: "'Rajdhani', monospace", fontWeight: 700 }}>
              {opp.netProfit >= 0 ? "+" : ""}¥{opp.netProfit.toLocaleString()}
            </span>
          </div>
        </div>

        {opp.warnings.length > 0 && (
          <div style={{ background: "#1a0f00", border: "1px solid #ff8c0033", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: "#ff8c00", marginBottom: 8, fontWeight: 600 }}>⚠ リスク警告</div>
            {opp.warnings.map(w => (
              <div key={w} style={{ fontSize: 12, color: "#cc7a00", marginBottom: 4 }}>• {w}</div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: 10, color: "#333", textAlign: "center", lineHeight: 1.6 }}>
          ※ 本表示は情報提供目的です。利益を保証するものではありません。<br />投資判断はご自身の責任でお願いします。
        </div>
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function ArbiScope() {
  const [tab, setTab] = useState("home");
  const [prices, setPrices] = useState(() => generatePrices());
  const [opps, setOpps] = useState([]);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [filterCoin, setFilterCoin] = useState("ALL");
  const [filterRank, setFilterRank] = useState("ALL");
  const [sortBy, setSortBy] = useState("profit");
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [flashNew, setFlashNew] = useState(false);
  const [showLearn, setShowLearn] = useState(null);
  const tickRef = useRef(0);

  const refresh = useCallback(() => {
    const p = generatePrices();
    setPrices(p);
    setOpps(calcArbitrage(p));
    setLastUpdate(new Date());
    setFlashNew(true);
    setTimeout(() => setFlashNew(false), 800);
    tickRef.current++;
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  const filtered = opps.filter(o => {
    if (filterCoin !== "ALL" && o.coin !== filterCoin) return false;
    if (filterRank !== "ALL" && o.rank !== filterRank) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "profit") return b.netProfit - a.netProfit;
    if (sortBy === "rate") return parseFloat(b.profitRate) - parseFloat(a.profitRate);
    return 0;
  });

  const topOpps = filtered.filter(o => o.rank === "S" || o.rank === "A").slice(0, 3);
  const trapCount = opps.filter(o => o.isTrap).length;
  const bestProfit = opps.length > 0 ? opps[0].netProfit : 0;
  const positiveCount = opps.filter(o => o.netProfit > 0).length;

  const learnItems = [
    { title: "アービトラージとは", icon: "⚡", body: "同じ資産が異なる市場で異なる価格で取引されている場合に、安い場所で買い、高い場所で売って差額を得る取引手法です。仮想通貨では取引所間の価格差が発生することがあります。" },
    { title: "スプレッドとは", icon: "↔", body: "買値と売値の差額のことです。例えばBTCの買値が1,300万円、売値が1,285万円なら、スプレッドは15万円。販売所ではスプレッドが大きく、見た目の価格差が利益に見えても実際は損することが多いです。" },
    { title: "板取引と販売所の違い", icon: "📊", body: "板取引は投資家同士が直接売買する方式で手数料が低め。販売所は取引所が相手方となる方式でスプレッドが広い。アービトラージには板取引の方が有利です。" },
    { title: "スリッページとは", icon: "📉", body: "注文時に想定した価格と実際の約定価格のズレです。板が薄い（取引量が少ない）銘柄ほど大きなスリッページが発生し、利益が吹き飛ぶことがあります。" },
    { title: "なぜ見かけの差で儲からないのか", icon: "🚨", body: "買い手数料 + 売り手数料 + 出金手数料 + 送金コスト + スリッページを合計すると、表面上の価格差が消えてしまうことがほとんどです。本アプリはこれらを自動計算します。" },
  ];

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Share+Tech+Mono&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #060a0e; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: #0d1117; }
    ::-webkit-scrollbar-thumb { background: #1e2530; border-radius: 2px; }
    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.9)} }
    @keyframes pulseRing { 0%{opacity:0.4;transform:scale(1)} 100%{opacity:0;transform:scale(3)} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
    @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
    @keyframes flash { 0%,100%{opacity:1} 50%{opacity:0.4} }
    @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
  `;

  return (
    <>
      <style>{styles}</style>
      <div style={{
        maxWidth: 480, margin: "0 auto",
        minHeight: "100vh", background: "#060a0e",
        color: "#c8d0da", fontFamily: "'Share Tech Mono', monospace",
        position: "relative", overflow: "hidden",
      }}>
        {/* Scanline effect */}
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(transparent, #00ff9d11, transparent)",
          animation: "scanline 4s linear infinite", pointerEvents: "none", zIndex: 200,
        }} />

        {/* Header */}
        <div style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "linear-gradient(180deg, #060a0e 80%, transparent 100%)",
          padding: "14px 16px 10px",
          borderBottom: "1px solid #1a2030",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "linear-gradient(135deg, #00ff9d22, #00ff9d44)",
                border: "1px solid #00ff9d55",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}>⚡</div>
              <div>
                <div style={{ fontSize: 18, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: "#00ff9d", letterSpacing: 2 }}>ArbiScope</div>
                <div style={{ fontSize: 9, color: "#444", letterSpacing: 1 }}>CRYPTO ARBITRAGE DETECTOR</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <PulsingDot color="#00ff9d" />
                <span style={{ fontSize: 9, color: "#555" }}>LIVE</span>
              </div>
              <div style={{
                fontSize: 10, color: "#444", fontFamily: "monospace",
                animation: flashNew ? "flash 0.4s 2" : "none",
              }}>
                {lastUpdate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            </div>
          </div>
        </div>

        {/* Ticker */}
        <div style={{
          background: "#0a0f15", borderBottom: "1px solid #1a2030",
          overflow: "hidden", height: 28, display: "flex", alignItems: "center",
        }}>
          <div style={{ animation: "ticker 20s linear infinite", display: "flex", gap: 0, whiteSpace: "nowrap" }}>
            {[...COINS, ...COINS].map((c, i) => {
              const exPrices = prices[c];
              const vals = exPrices ? Object.values(exPrices) : [];
              const mid = vals.length > 0 ? vals[0].mid : 0;
              const chg = vals.length > 0 ? parseFloat(vals[0].change24h) : 0;
              return (
                <span key={i} style={{ fontSize: 10, color: chg >= 0 ? "#00cc7a" : "#cc3333", paddingRight: 24 }}>
                  {c} ¥{mid.toLocaleString()} <span style={{ opacity: 0.6 }}>{chg >= 0 ? "▲" : "▼"}{Math.abs(chg)}%</span>
                  <span style={{ color: "#1e2530", marginLeft: 20 }}>|</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "16px 16px 80px" }}>
          {tab === "home" && (
            <>
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <StatCard label="本日最大純利益" value={`¥${bestProfit.toLocaleString()}`} color="#00ff9d" />
                <StatCard label="実行候補数" value={positiveCount} sub={`全${opps.length}件中`} color="#39ff14" />
                <StatCard label="罠判定数" value={trapCount} sub="要注意" color="#ff3131" />
                <StatCard label="監視銘柄" value={COINS.length} sub={`${EXCHANGES.length}取引所`} color="#7b61ff" />
              </div>

              {/* Top Opportunities */}
              {topOpps.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    <PulsingDot color="#00ff9d" />
                    注目チャンス
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {topOpps.map(o => (
                      <OpportunityCard key={o.id} opp={o} onClick={setSelectedOpp} isSelected={selectedOpp?.id === o.id} />
                    ))}
                  </div>
                </div>
              )}

              {/* Quick price table */}
              <div style={{ background: "#0d1117", border: "1px solid #1e2530", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid #1e2530", fontSize: 10, color: "#555", letterSpacing: 2 }}>価格スナップショット</div>
                {COINS.slice(0, 5).map(coin => {
                  const exPrices = prices[coin];
                  const allPrices = Object.values(exPrices).map(e => e.mid);
                  const minP = Math.min(...allPrices);
                  const maxP = Math.max(...allPrices);
                  const diffPct = ((maxP - minP) / minP * 100).toFixed(2);
                  const chg = parseFloat(Object.values(exPrices)[0].change24h);
                  return (
                    <div key={coin} style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #0f1520" }}>
                      <CoinTag coin={coin} />
                      <div style={{ flex: 1, marginLeft: 10, fontSize: 13, fontFamily: "monospace" }}>
                        ¥{minP.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 11, color: diffPct > 1 ? "#00ff9d" : "#555", marginRight: 10 }}>
                        差{diffPct}%
                      </div>
                      <div style={{ fontSize: 11, color: chg >= 0 ? "#00cc7a" : "#cc3333" }}>
                        {chg >= 0 ? "▲" : "▼"}{Math.abs(chg)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === "ranking" && (
            <>
              {/* Filters */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 8 }}>
                  {["ALL", ...COINS].map(c => (
                    <button key={c} onClick={() => setFilterCoin(c)} style={{
                      flexShrink: 0, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11,
                      background: filterCoin === c ? "#00ff9d22" : "#0d1117",
                      border: `1px solid ${filterCoin === c ? "#00ff9d55" : "#1e2530"}`,
                      color: filterCoin === c ? "#00ff9d" : "#555",
                    }}>{c}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["ALL", "S", "A", "B", "C", "D"].map(r => (
                    <button key={r} onClick={() => setFilterRank(r)} style={{
                      flexShrink: 0, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11,
                      background: filterRank === r ? "#7b61ff22" : "#0d1117",
                      border: `1px solid ${filterRank === r ? "#7b61ff55" : "#1e2530"}`,
                      color: filterRank === r ? "#7b61ff" : "#555",
                    }}>{r === "ALL" ? "全" : `${r}ランク`}</button>
                  ))}
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setSortBy(sortBy === "profit" ? "rate" : "profit")} style={{
                    padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11,
                    background: "#0d1117", border: "1px solid #1e2530", color: "#888",
                  }}>{sortBy === "profit" ? "額順" : "率順"}</button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filtered.length === 0 && (
                  <div style={{ textAlign: "center", padding: 40, color: "#333", fontSize: 13 }}>条件に合う案件がありません</div>
                )}
                {filtered.slice(0, 30).map(o => (
                  <OpportunityCard key={o.id} opp={o} onClick={setSelectedOpp} isSelected={selectedOpp?.id === o.id} />
                ))}
              </div>
            </>
          )}

          {tab === "prices" && (
            <div>
              {COINS.map(coin => (
                <div key={coin} style={{ background: "#0d1117", border: "1px solid #1e2530", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #1e2530", display: "flex", alignItems: "center", gap: 8 }}>
                    <CoinTag coin={coin} />
                  </div>
                  {EXCHANGES.map(ex => {
                    const d = prices[coin][ex];
                    return (
                      <div key={ex} style={{
                        display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr",
                        padding: "8px 14px", borderBottom: "1px solid #0f1520",
                        fontSize: 11,
                      }}>
                        <span style={{ color: "#666" }}>{ex}</span>
                        <span style={{ color: "#ccc", fontFamily: "monospace" }}>¥{d.sell.toLocaleString()}</span>
                        <span style={{ color: "#aaa", fontFamily: "monospace" }}>¥{d.buy.toLocaleString()}</span>
                        <span style={{ color: parseFloat(d.change24h) >= 0 ? "#00cc7a" : "#cc3333" }}>
                          {parseFloat(d.change24h) >= 0 ? "▲" : "▼"}{Math.abs(parseFloat(d.change24h))}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {tab === "learn" && (
            <div>
              <div style={{ fontSize: 12, color: "#444", marginBottom: 16, lineHeight: 1.8 }}>
                仮想通貨アービトラージを始める前に、<br />
                必ず知っておくべき基礎知識です。
              </div>
              {learnItems.map((item, i) => (
                <div
                  key={i}
                  onClick={() => setShowLearn(showLearn === i ? null : i)}
                  style={{
                    background: showLearn === i ? "#0a1520" : "#0d1117",
                    border: `1px solid ${showLearn === i ? "#7b61ff55" : "#1e2530"}`,
                    borderRadius: 12, padding: "14px 16px", marginBottom: 8,
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <span style={{ fontSize: 14, color: "#aaa", flex: 1 }}>{item.title}</span>
                    <span style={{ color: "#444", fontSize: 12 }}>{showLearn === i ? "▲" : "▼"}</span>
                  </div>
                  {showLearn === i && (
                    <div style={{ marginTop: 12, fontSize: 12, color: "#666", lineHeight: 1.8, borderTop: "1px solid #1e2530", paddingTop: 12 }}>
                      {item.body}
                    </div>
                  )}
                </div>
              ))}

              <div style={{ marginTop: 20, background: "#100a05", border: "1px solid #ff3131aa", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, color: "#ff3131", fontWeight: 700, marginBottom: 10 }}>⚠ 免責事項</div>
                <div style={{ fontSize: 11, color: "#553333", lineHeight: 1.8 }}>
                  本アプリは情報提供を目的としており、利益を保証するものではありません。<br />
                  API遅延・メンテナンス等により表示が正確でない場合があります。<br />
                  投資判断はご自身の責任で行ってください。
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Nav */}
        <div style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 480,
          background: "linear-gradient(0deg, #060a0e 90%, transparent 100%)",
          borderTop: "1px solid #1a2030",
          display: "flex", padding: "10px 0 20px",
        }}>
          {[
            { id: "home", icon: "⚡", label: "ホーム" },
            { id: "ranking", icon: "📊", label: "チャンス" },
            { id: "prices", icon: "💹", label: "価格表" },
            { id: "learn", icon: "📚", label: "学習" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, background: "none", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              padding: "6px 0", transition: "all 0.2s",
            }}>
              <span style={{ fontSize: 18, filter: tab === t.id ? "drop-shadow(0 0 6px #00ff9d)" : "none" }}>
                {t.icon}
              </span>
              <span style={{ fontSize: 9, color: tab === t.id ? "#00ff9d" : "#333", letterSpacing: 0.5 }}>
                {t.label}
              </span>
              {tab === t.id && (
                <div style={{ width: 20, height: 2, background: "#00ff9d", borderRadius: 1, boxShadow: "0 0 6px #00ff9d" }} />
              )}
            </button>
          ))}
        </div>

        {/* Detail modal */}
        {selectedOpp && <DetailPanel opp={selectedOpp} onClose={() => setSelectedOpp(null)} />}
      </div>
    </>
  );
}
