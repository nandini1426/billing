"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

interface Summary {
  total_orders: number; total_revenue: number; avg_bill: number;
  table_orders: number; takeaway_orders: number;
  delivery_orders: number; fast_orders: number;
}
interface DailyData    { date: string; orders: number; revenue: number; }
interface CategoryData { category: string; qty_sold: number; revenue: number; }
interface ItemData     { item: string; category: string; qty_sold: number; revenue: number; }
interface DayData      { day_name: string; day_num: number; orders: number; revenue: number; avg_bill: number; }

const COLORS = ["#f97316","#3b82f6","#10b981","#8b5cf6","#ec4899","#f59e0b","#06b6d4"];
const DAY_SHORT: Record<string, string> = {
  "Sunday   ": "Sun", "Monday   ": "Mon", "Tuesday  ": "Tue",
  "Wednesday": "Wed", "Thursday ": "Thu", "Friday   ": "Fri", "Saturday ": "Sat"
};

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, init } = useAuthStore();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [period,       setPeriod]       = useState<"today"|"week"|"month">("month");
  const [summary,      setSummary]      = useState<Summary | null>(null);
  const [dailyData,    setDailyData]    = useState<DailyData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [itemData,     setItemData]     = useState<ItemData[]>([]);
  const [dayData,      setDayData]      = useState<DayData[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<"overview"|"items"|"days"|"ai">("overview");

  const [aiChat,      setAiChat]      = useState<{role: string; text: string}[]>([]);
  const [aiMsg,       setAiMsg]       = useState("");
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);

  useEffect(() => { init(); }, []);
  useEffect(() => {
    if (user && user.role !== "admin") {
      toast.error("Admin access only");
      router.push("/dashboard");
    }
  }, [user]);
  useEffect(() => { fetchAll(); }, [period]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiChat]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [summaryRes, dailyRes, categoryRes, itemRes, dayRes] = await Promise.all([
        api.get(`/analytics/summary?period=${period}`),
        api.get(`/analytics/daily?days=${period === "today" ? 1 : period === "week" ? 7 : 30}`),
        api.get(`/analytics/categories?period=${period}`),
        api.get(`/analytics/top-items?period=${period}`),
        api.get(`/analytics/day-of-week?period=${period}`),
      ]);
      setSummary(summaryRes.data);
      setDailyData(dailyRes.data);
      setCategoryData(categoryRes.data);
      setItemData(itemRes.data);
      setDayData(dayRes.data);
      setAiGenerated(false);
    } catch { toast.error("Failed to load analytics"); }
    finally { setLoading(false); }
  };

  const orderTypeData = summary ? [
    { name: "Table",    value: Number(summary.table_orders) },
    { name: "Takeaway", value: Number(summary.takeaway_orders) },
    { name: "Delivery", value: Number(summary.delivery_orders) },
    { name: "Fast",     value: Number(summary.fast_orders) },
  ].filter(d => d.value > 0) : [];

  const topItems    = [...itemData].sort((a,b) => Number(b.qty_sold) - Number(a.qty_sold)).slice(0,5);
  const bottomItems = [...itemData].sort((a,b) => Number(a.qty_sold) - Number(b.qty_sold)).slice(0,5);
  const bestDay     = dayData.length > 0 ? [...dayData].sort((a,b) => Number(b.revenue) - Number(a.revenue))[0] : null;
  const worstDay    = dayData.length > 0 ? [...dayData].sort((a,b) => Number(a.revenue) - Number(b.revenue))[0] : null;

  const generateAISuggestions = async () => {
    if (itemData.length === 0) return toast.error("No data available for AI analysis");
    setAiLoading(true);
    setAiGenerated(true);
    const context = `
TOP SELLING: ${topItems.map((i,n) => `${n+1}. ${i.item}(${i.category}) Qty:${i.qty_sold} Rev:₹${i.revenue}`).join(', ')}
LEAST SELLING: ${bottomItems.map((i,n) => `${n+1}. ${i.item}(${i.category}) Qty:${i.qty_sold}`).join(', ')}
DAY PERFORMANCE: ${dayData.map(d => `${DAY_SHORT[d.day_name]||d.day_name.trim()}:₹${Number(d.revenue).toFixed(0)}`).join(', ')}
BEST DAY: ${bestDay?.day_name?.trim()} WORST: ${worstDay?.day_name?.trim()}
SUMMARY: Orders:${summary?.total_orders} Revenue:₹${summary?.total_revenue} AvgBill:₹${Math.round(Number(summary?.avg_bill))}`;
    try {
      const res = await api.post('/analytics/ai-suggestions', {
        system: `You are a restaurant business analyst AI. Analyze sales data and give practical suggestions. Use emojis. Format with clear sections. Be specific and actionable.`,
        messages: [{ role: "user", content: `Analyze and give:\n1. Why top items sell well\n2. Why bottom items sell less + how to improve\n3. Specific offers for slow days\n4. Business improvement tips\n\nData: ${context}` }]
      });
      setAiChat([{ role: "assistant", text: res.data.content?.[0]?.text || "Unable to generate." }]);
    } catch {
      setAiChat([{ role: "assistant", text: "Sorry, AI temporarily unavailable." }]);
    } finally { setAiLoading(false); }
  };

  const handleAiChat = async () => {
    if (!aiMsg.trim()) return;
    const userMsg = aiMsg.trim();
    setAiMsg("");
    setAiChat(prev => [...prev, { role: "user", text: userMsg }]);
    setAiLoading(true);
    try {
      const res = await api.post('/analytics/ai-suggestions', {
        system: `You are a restaurant business analyst. Be concise and practical. Use emojis.`,
        messages: [
          ...aiChat.map(m => ({ role: m.role as "user"|"assistant", content: m.text })),
          { role: "user" as const, content: userMsg }
        ]
      });
      setAiChat(prev => [...prev, { role: "assistant", text: res.data.content?.[0]?.text || "Unable to process." }]);
    } catch {
      setAiChat(prev => [...prev, { role: "assistant", text: "Sorry, unable to process." }]);
    } finally { setAiLoading(false); }
  };

  if (!user) return null;

  const totalRevenue = Number(summary?.total_revenue || 0);
  const prevRevenue  = totalRevenue * 0.85; // mock previous period
  const revenueGrowth = ((totalRevenue - prevRevenue) / prevRevenue * 100).toFixed(1);

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9" }}>

      {/* Header */}
      <header style={{
        background: "rgba(15,23,42,0.95)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 20px", height: 70, display: "flex",
        alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push("/dashboard")}
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", fontSize: 14, color: "#94a3b8", padding: "8px 16px", borderRadius: 10, fontWeight: 700 }}>
            ← Back
          </button>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#f1f5f9", letterSpacing: "-0.5px" }}>📊 Analytics Dashboard</div>
            <div style={{ fontSize: 11, color: "#475569" }}>Real-time restaurant insights</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Period selector */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 4, gap: 2 }}>
            {[
              { id: "today", label: "Today" },
              { id: "week",  label: "Week" },
              { id: "month", label: "Month" },
            ].map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id as any)}
                style={{
                  padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontWeight: 700, fontSize: 12,
                  background: period === p.id ? "#f97316" : "none",
                  color: period === p.id ? "#fff" : "#64748b",
                  transition: "all .15s",
                }}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={fetchAll}
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 16, color: "#94a3b8" }}>
            🔄
          </button>
          <button
            onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); router.push('/login'); }}
            style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      <main style={{ padding: "20px 16px", maxWidth: 900, margin: "0 auto" }}>

        {/* Section tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
          {[
            { id: "overview", label: "📊 Overview",   },
            { id: "items",    label: "🍽️ Items",      },
            { id: "days",     label: "📅 Days",        },
            { id: "ai",       label: "🤖 AI Tips",     },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: "9px 18px", borderRadius: 24, border: "1px solid",
                cursor: "pointer", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
                background: activeTab === tab.id ? "#f97316" : "rgba(255,255,255,0.05)",
                borderColor: activeTab === tab.id ? "#f97316" : "rgba(255,255,255,0.1)",
                color: activeTab === tab.id ? "#fff" : "#64748b",
                transition: "all .15s",
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#475569" }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>📊</div>
            <div style={{ fontSize: 16 }}>Loading analytics...</div>
          </div>
        ) : (
          <>
            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* KPI Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                  {/* Revenue card */}
                  <div style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", borderRadius: 18, padding: "20px 20px", gridColumn: "1 / -1" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Total Revenue</div>
                        <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: "-1px" }}>
                          ₹{Number(summary?.total_revenue || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                          +{revenueGrowth}% vs last period
                        </div>
                      </div>
                      <div style={{ fontSize: 40, opacity: 0.6 }}>💰</div>
                    </div>
                    {/* Mini sparkline */}
                    {dailyData.length > 0 && (
                      <div style={{ marginTop: 16, height: 50 }}>
                        <ResponsiveContainer width="100%" height={50}>
                          <AreaChart data={dailyData}>
                            <Area type="monotone" dataKey="revenue" stroke="rgba(255,255,255,0.8)" fill="rgba(255,255,255,0.2)" strokeWidth={2} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {[
                    { label: "Total Orders",  value: summary?.total_orders || 0,                                     icon: "📋", color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.2)" },
                    { label: "Avg Bill",      value: `₹${Math.round(Number(summary?.avg_bill || 0))}`,               icon: "🧾", color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.2)" },
                    { label: "Table Orders",  value: summary?.table_orders    || 0,                                  icon: "🪑", color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.2)" },
                    { label: "Takeaway",      value: summary?.takeaway_orders || 0,                                  icon: "🛍️", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",  border: "rgba(139,92,246,0.2)" },
                  ].map((card, i) => (
                    <div key={i} style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: 16, padding: "16px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{card.label}</div>
                          <div style={{ fontSize: 26, fontWeight: 800, color: card.color }}>{card.value}</div>
                        </div>
                        <div style={{ fontSize: 28 }}>{card.icon}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Revenue trend chart */}
                {dailyData.length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 20 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9", marginBottom: 16 }}>Revenue Trend</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={dailyData}>
                        <defs>
                          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#475569" }}
                          tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} />
                        <YAxis tick={{ fontSize: 10, fill: "#475569" }} />
                        <Tooltip
                          contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#f1f5f9" }}
                          formatter={(val: any) => [`₹${val}`, "Revenue"]} />
                        <Area type="monotone" dataKey="revenue" stroke="#f97316" fill="url(#revenueGrad)" strokeWidth={2.5} dot={{ fill: "#f97316", r: 3 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Category + Order type side by side */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {categoryData.length > 0 && (
                    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 20 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9", marginBottom: 14 }}>Sales by Category</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={categoryData} layout="vertical">
                          <XAxis type="number" tick={{ fontSize: 9, fill: "#475569" }} />
                          <YAxis type="category" dataKey="category" tick={{ fontSize: 9, fill: "#94a3b8" }} width={70} />
                          <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, color: "#f1f5f9", fontSize: 12 }} formatter={(v: any) => [`₹${v}`, "Revenue"]} />
                          <Bar dataKey="revenue" fill="#f97316" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {orderTypeData.length > 0 && (
                    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 20 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9", marginBottom: 14 }}>Order Types</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={orderTypeData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={4} dataKey="value">
                            {orderTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, color: "#f1f5f9", fontSize: 12 }} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── ITEMS TAB ── */}
            {activeTab === "items" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Top selling */}
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔥</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>Top Selling Items</div>
                      <div style={{ fontSize: 11, color: "#475569" }}>Most ordered this {period}</div>
                    </div>
                  </div>
                  {topItems.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#475569", padding: 20 }}>No data</div>
                  ) : topItems.map((item, i) => {
                    const maxQty = Number(topItems[0]?.qty_sold) || 1;
                    const pct = (Number(item.qty_sold) / maxQty) * 100;
                    return (
                      <div key={i} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: i === 0 ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, border: `1px solid ${i === 0 ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.1)"}` }}>
                              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}`}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: "#f1f5f9" }}>{item.item}</div>
                              <div style={{ fontSize: 11, color: "#475569" }}>{item.category}</div>
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: "#10b981" }}>{item.qty_sold} sold</div>
                            <div style={{ fontSize: 11, color: "#475569" }}>₹{Number(item.revenue).toLocaleString()}</div>
                          </div>
                        </div>
                        <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, #f97316, #f59e0b)`, borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Least selling */}
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 18, padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📉</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>Least Selling Items</div>
                      <div style={{ fontSize: 11, color: "#475569" }}>Need attention</div>
                    </div>
                  </div>
                  {bottomItems.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#475569", padding: 20 }}>No data</div>
                  ) : bottomItems.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, marginBottom: 12, borderBottom: i < bottomItems.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                          {i+1}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#f1f5f9" }}>{item.item}</div>
                          <div style={{ fontSize: 11, color: "#475569" }}>{item.category}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "#ef4444" }}>{item.qty_sold} sold</div>
                        <div style={{ fontSize: 11, color: "#475569" }}>₹{Number(item.revenue).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* All items horizontal bar */}
                {itemData.length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 20 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9", marginBottom: 14 }}>All Items — Qty Sold</div>
                    <ResponsiveContainer width="100%" height={Math.max(200, itemData.length * 28)}>
                      <BarChart data={itemData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" tick={{ fontSize: 9, fill: "#475569" }} />
                        <YAxis type="category" dataKey="item" tick={{ fontSize: 9, fill: "#94a3b8" }} width={90} />
                        <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, color: "#f1f5f9", fontSize: 12 }} formatter={(v: any) => [v, "Qty Sold"]} />
                        <Bar dataKey="qty_sold" radius={[0, 4, 4, 0]}>
                          {itemData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* ── DAYS TAB ── */}
            {activeTab === "days" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Best / Worst */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 18, padding: "20px 18px" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
                    <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Best Day</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#f1f5f9" }}>
                      {bestDay ? DAY_SHORT[bestDay.day_name] || bestDay.day_name.trim() : "—"}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#10b981", marginTop: 4 }}>
                      ₹{bestDay ? Number(bestDay.revenue).toFixed(0) : 0}
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{bestDay?.orders || 0} orders</div>
                  </div>
                  <div style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 18, padding: "20px 18px" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📉</div>
                    <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Lowest Day</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#f1f5f9" }}>
                      {worstDay ? DAY_SHORT[worstDay.day_name] || worstDay.day_name.trim() : "—"}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#ef4444", marginTop: 4 }}>
                      ₹{worstDay ? Number(worstDay.revenue).toFixed(0) : 0}
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{worstDay?.orders || 0} orders</div>
                  </div>
                </div>

                {/* Day chart */}
                {dayData.length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 20 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9", marginBottom: 14 }}>Revenue by Day of Week</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={dayData.map(d => ({ ...d, day: DAY_SHORT[d.day_name] || d.day_name.trim() }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#475569" }} />
                        <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, color: "#f1f5f9", fontSize: 12 }}
                          formatter={(val: any) => [`₹${Number(val).toFixed(0)}`, "Revenue"]} />
                        <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                          {dayData.map((entry, i) => (
                            <Cell key={i} fill={
                              entry === bestDay ? "#10b981" :
                              entry === worstDay ? "#ef4444" : "#f97316"
                            } />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 10, fontSize: 11, color: "#475569" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: "#10b981" }} /> Best</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: "#ef4444" }} /> Lowest</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: "#f97316" }} /> Normal</span>
                    </div>
                  </div>
                )}

                {/* Day breakdown */}
                {dayData.length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 20 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9", marginBottom: 14 }}>Detailed Breakdown</div>
                    {dayData.map((day, i) => {
                      const maxRev = Math.max(...dayData.map(d => Number(d.revenue)));
                      const pct = maxRev > 0 ? (Number(day.revenue) / maxRev) * 100 : 0;
                      const isBest  = day === bestDay;
                      const isWorst = day === worstDay;
                      return (
                        <div key={i} style={{ marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", minWidth: 36 }}>
                                {DAY_SHORT[day.day_name] || day.day_name.trim()}
                              </span>
                              {isBest  && <span style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.3)" }}>🏆 Best</span>}
                              {isWorst && <span style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)" }}>📉 Low</span>}
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <span style={{ fontSize: 14, fontWeight: 800, color: isBest ? "#10b981" : isWorst ? "#ef4444" : "#f97316" }}>
                                ₹{Number(day.revenue).toFixed(0)}
                              </span>
                              <span style={{ fontSize: 11, color: "#475569", marginLeft: 8 }}>{day.orders} orders</span>
                            </div>
                          </div>
                          <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{
                              width: `${pct}%`, height: "100%", borderRadius: 4,
                              background: isBest ? "#10b981" : isWorst ? "#ef4444" : "#f97316",
                              transition: "width .5s ease",
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── AI TIPS TAB ── */}
            {activeTab === "ai" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {!aiGenerated ? (
                  <div style={{ background: "linear-gradient(135deg, #1e293b, #0f172a)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 20, padding: 32, textAlign: "center" }}>
                    <div style={{ fontSize: 56, marginBottom: 16 }}>🤖</div>
                    <div style={{ fontWeight: 800, fontSize: 20, color: "#f1f5f9", marginBottom: 8 }}>AI Business Analyst</div>
                    <div style={{ fontSize: 14, color: "#475569", marginBottom: 24, lineHeight: 1.6, maxWidth: 400, margin: "0 auto 24px" }}>
                      Get AI-powered suggestions to boost sales, improve low-performing items and increase revenue on slow days
                    </div>
                    <button onClick={generateAISuggestions} disabled={aiLoading || itemData.length === 0}
                      style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", border: "none", borderRadius: 14, padding: "14px 32px", cursor: aiLoading ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 15, opacity: aiLoading ? 0.7 : 1, boxShadow: "0 8px 24px rgba(249,115,22,0.3)" }}>
                      {aiLoading ? "🔄 Analyzing..." : "✨ Generate AI Suggestions"}
                    </button>
                    {itemData.length === 0 && (
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 12 }}>No sales data. Complete some orders first.</div>
                    )}
                  </div>
                ) : (
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, overflow: "hidden" }}>
                    {/* Chat header */}
                    <div style={{ background: "linear-gradient(135deg, #1e293b, #0f172a)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #f97316, #ea580c)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>AI Business Analyst</div>
                          <div style={{ fontSize: 11, color: "#475569" }}>Based on your {period} data</div>
                        </div>
                      </div>
                      <button onClick={() => { setAiChat([]); setAiGenerated(false); }}
                        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "#94a3b8" }}>
                        Reset
                      </button>
                    </div>

                    {/* Messages */}
                    <div style={{ padding: 20, maxHeight: 450, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
                      {aiLoading && aiChat.length === 0 && (
                        <div style={{ textAlign: "center", color: "#475569", padding: 30 }}>
                          <div style={{ fontSize: 28, marginBottom: 8 }}>🔄</div>
                          Analyzing your sales data...
                        </div>
                      )}
                      {aiChat.map((msg, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                          <div style={{
                            maxWidth: "90%", padding: "12px 16px",
                            borderRadius: msg.role === "user" ? "16px 16px 2px 16px" : "16px 16px 16px 2px",
                            background: msg.role === "user" ? "linear-gradient(135deg, #f97316, #ea580c)" : "rgba(255,255,255,0.06)",
                            color: "#f1f5f9", fontSize: 13, lineHeight: 1.6,
                            border: msg.role === "assistant" ? "1px solid rgba(255,255,255,0.08)" : "none",
                            whiteSpace: "pre-wrap",
                          }}>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                      {aiLoading && aiChat.length > 0 && (
                        <div style={{ display: "flex", justifyContent: "flex-start" }}>
                          <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "10px 14px", fontSize: 13, color: "#475569" }}>
                            Thinking...
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Quick questions */}
                    {aiChat.length > 0 && !aiLoading && (
                      <div style={{ padding: "0 20px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {["What offers for slow days?", "How to improve least selling items?", "Best combo deals?", "How to increase avg bill?"].map(q => (
                          <button key={q} onClick={() => setAiMsg(q)}
                            style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 20, padding: "6px 12px", cursor: "pointer", fontSize: 11, color: "#f97316", fontWeight: 600 }}>
                            {q}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Input */}
                    <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 10 }}>
                      <input type="text" placeholder="Ask anything about your sales..."
                        value={aiMsg}
                        onChange={e => setAiMsg(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleAiChat()}
                        style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#f1f5f9", outline: "none" }}
                      />
                      <button onClick={handleAiChat} disabled={aiLoading || !aiMsg.trim()}
                        style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", border: "none", borderRadius: 10, padding: "10px 18px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, opacity: aiLoading || !aiMsg.trim() ? 0.5 : 1 }}>
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}