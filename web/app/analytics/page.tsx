"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";
import {
  LineChart, Line, BarChart, Bar,
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

  // AI state
  const [aiChat,       setAiChat]       = useState<{role: string; text: string}[]>([]);
  const [aiMsg,        setAiMsg]        = useState("");
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiGenerated,  setAiGenerated]  = useState(false);

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

  const topItems    = [...itemData].sort((a, b) => Number(b.qty_sold) - Number(a.qty_sold)).slice(0, 5);
  const bottomItems = [...itemData].sort((a, b) => Number(a.qty_sold) - Number(b.qty_sold)).slice(0, 5);
  const bestDay     = dayData.length > 0 ? [...dayData].sort((a, b) => Number(b.revenue) - Number(a.revenue))[0] : null;
  const worstDay    = dayData.length > 0 ? [...dayData].sort((a, b) => Number(a.revenue) - Number(b.revenue))[0] : null;

  const generateAISuggestions = async () => {
  if (itemData.length === 0) return toast.error("No data available for AI analysis");
  setAiLoading(true);
  setAiGenerated(true);

  const context = `
Restaurant Analytics Data (${period}):

TOP SELLING ITEMS:
${topItems.map((i, n) => `${n+1}. ${i.item} (${i.category}) - Qty: ${i.qty_sold}, Revenue: ₹${i.revenue}`).join('\n')}

LEAST SELLING ITEMS:
${bottomItems.map((i, n) => `${n+1}. ${i.item} (${i.category}) - Qty: ${i.qty_sold}, Revenue: ₹${i.revenue}`).join('\n')}

DAY OF WEEK PERFORMANCE:
${dayData.map(d => `${DAY_SHORT[d.day_name] || d.day_name.trim()}: Orders: ${d.orders}, Revenue: ₹${Number(d.revenue).toFixed(0)}`).join('\n')}

BEST DAY: ${bestDay ? `${bestDay.day_name.trim()} (₹${Number(bestDay.revenue).toFixed(0)})` : 'N/A'}
WORST DAY: ${worstDay ? `${worstDay.day_name.trim()} (₹${Number(worstDay.revenue).toFixed(0)})` : 'N/A'}

SUMMARY:
Total Orders: ${summary?.total_orders}, Total Revenue: ₹${summary?.total_revenue}, Avg Bill: ₹${Math.round(Number(summary?.avg_bill))}
  `;

  try {
    const res = await api.post('/analytics/ai-suggestions', {
      system: `You are a restaurant business analyst AI. Analyze the provided restaurant sales data and give practical, actionable suggestions. Be specific, concise and helpful. Use emojis to make it engaging. Format your response with clear sections.`,
      messages: [{
        role: "user",
        content: `Analyze this restaurant data and give me:
1. Why top items are selling well
2. Why bottom items are selling less and how to improve
3. Specific offers/discounts for low sale days
4. Overall business improvement suggestions

${context}`
      }]
    });
    const reply = res.data.content?.[0]?.text || "Unable to generate suggestions.";
    setAiChat([{ role: "assistant", text: reply }]);
  } catch {
    setAiChat([{ role: "assistant", text: "Sorry, AI suggestions are temporarily unavailable. Please try again." }]);
  } finally { setAiLoading(false); }
};

  const handleAiChat = async () => {
  if (!aiMsg.trim()) return;
  const userMsg = aiMsg.trim();
  setAiMsg("");
  setAiChat(prev => [...prev, { role: "user", text: userMsg }]);
  setAiLoading(true);

  const context = `
TOP ITEMS: ${topItems.map(i => `${i.item}(${i.qty_sold})`).join(', ')}
BOTTOM ITEMS: ${bottomItems.map(i => `${i.item}(${i.qty_sold})`).join(', ')}
BEST DAY: ${bestDay?.day_name?.trim()} WORST DAY: ${worstDay?.day_name?.trim()}
TOTAL REVENUE: ₹${summary?.total_revenue} TOTAL ORDERS: ${summary?.total_orders}
  `;

  try {
    const res = await api.post('/analytics/ai-suggestions', {
      system: `You are a restaurant business analyst AI. Answer questions about the restaurant's sales data. Be specific, concise and practical. Use emojis.`,
      messages: [
        ...aiChat.map(m => ({ role: m.role as "user"|"assistant", content: m.text })),
        { role: "user" as const, content: `Context: ${context}\n\nQuestion: ${userMsg}` }
      ]
    });
    const reply = res.data.content?.[0]?.text || "Unable to process your question.";
    setAiChat(prev => [...prev, { role: "assistant", text: reply }]);
  } catch {
    setAiChat(prev => [...prev, { role: "assistant", text: "Sorry, unable to process. Please try again." }]);
  } finally { setAiLoading(false); }
};

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>

      {/* Header */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #e2e8f0",
        padding: "0 16px", height: 70, display: "flex",
        alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/dashboard")}
            style={{ background: "#f1f5f9", border: "none", cursor: "pointer", fontSize: 16, color: "#374151", padding: "10px 16px", borderRadius: 10, fontWeight: 700 }}>
            ← Back
          </button>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#111827" }}>📊 Analytics</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={fetchAll}
            style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 16, color: "#ea580c" }}>
            🔄
          </button>
          <button
            onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); router.push('/login'); }}
            style={{ width: 40, height: 40, borderRadius: "50%", background: "#fee2e2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto" }}>

        {/* Period selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { id: "today", label: "Today" },
            { id: "week",  label: "Week" },
            { id: "month", label: "Month" },
          ].map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id as any)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 12,
                fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer",
                background: period === p.id ? "#f97316" : "#fff",
                color: period === p.id ? "#fff" : "#374151",
                boxShadow: period === p.id ? "0 4px 12px rgba(249,115,22,0.3)" : "0 1px 4px rgba(0,0,0,0.06)",
              }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Section tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          {[
            { id: "overview", label: "📊 Overview" },
            { id: "items",    label: "🍽️ Items" },
            { id: "days",     label: "📅 Days" },
            { id: "ai",       label: "🤖 AI Tips" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: "8px 16px", borderRadius: 20, border: "none",
                cursor: "pointer", fontSize: 13, fontWeight: 700,
                whiteSpace: "nowrap",
                background: activeTab === tab.id ? "#1e293b" : "#fff",
                color: activeTab === tab.id ? "#fff" : "#374151",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📊</div>
            Loading analytics...
          </div>
        ) : (
          <>
            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Summary cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {[
                    { label: "Total Orders",  value: summary?.total_orders || 0,                                icon: "📋", bg: "#eff6ff",  color: "#2563eb" },
                    { label: "Total Revenue", value: `₹${Number(summary?.total_revenue || 0).toLocaleString()}`, icon: "💰", bg: "#f0fdf4",  color: "#16a34a" },
                    { label: "Avg Bill",      value: `₹${Math.round(Number(summary?.avg_bill || 0))}`,          icon: "🧾", bg: "#faf5ff",  color: "#7c3aed" },
                    { label: "Categories",    value: categoryData.length,                                        icon: "📂", bg: "#fff7ed",  color: "#ea580c" },
                  ].map((card, i) => (
                    <div key={i} style={{ background: card.bg, borderRadius: 14, padding: "14px 16px" }}>
                      <div style={{ fontSize: 20, marginBottom: 6 }}>{card.icon}</div>
                      <div style={{ fontSize: 11, color: card.color, fontWeight: 600, opacity: 0.8, marginBottom: 2 }}>{card.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: card.color }}>{card.value}</div>
                    </div>
                  ))}
                </div>

                {/* Order type breakdown */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {[
                    { label: "Table",    value: summary?.table_orders    || 0, icon: "🪑", color: "#ea580c" },
                    { label: "Takeaway", value: summary?.takeaway_orders || 0, icon: "🛍️", color: "#2563eb" },
                    { label: "Delivery", value: summary?.delivery_orders || 0, icon: "🛵", color: "#16a34a" },
                    { label: "Fast",     value: summary?.fast_orders     || 0, icon: "⚡", color: "#7c3aed" },
                  ].map((card, i) => (
                    <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "10px 8px", textAlign: "center", border: "1px solid #f3f4f6" }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{card.icon}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: card.color }}>{card.value}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{card.label}</div>
                    </div>
                  ))}
                </div>

                {/* Revenue chart */}
                {dailyData.length > 0 && (
                  <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #f3f4f6" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 12 }}>Revenue Trend</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }}
                          tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(val: any) => [`₹${val}`, "Revenue"]} />
                        <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2.5} dot={{ fill: "#f97316", r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Pie chart */}
                {orderTypeData.length > 0 && (
                  <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #f3f4f6" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 12 }}>Orders by Type</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={orderTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                          {orderTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* ── ITEMS TAB ── */}
            {activeTab === "items" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Top selling */}
                <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #f3f4f6" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 36, height: 36, background: "#f0fdf4", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔥</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>Top Selling Items</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>Most ordered items</div>
                    </div>
                  </div>
                  {topItems.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>No data available</div>
                  ) : (
                    topItems.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, marginBottom: 12, borderBottom: i < topItems.length - 1 ? "1px solid #f8fafc" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, background: i === 0 ? "#fef9c3" : i === 1 ? "#f1f5f9" : "#f8fafc", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: i === 0 ? "#ca8a04" : "#64748b" }}>
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}`}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{item.item}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>{item.category}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "#16a34a" }}>{item.qty_sold} sold</div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>₹{Number(item.revenue).toLocaleString()}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Bottom selling */}
                <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #f3f4f6" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 36, height: 36, background: "#fef2f2", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📉</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>Least Selling Items</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>Need attention</div>
                    </div>
                  </div>
                  {bottomItems.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>No data available</div>
                  ) : (
                    bottomItems.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, marginBottom: 12, borderBottom: i < bottomItems.length - 1 ? "1px solid #f8fafc" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, background: "#fef2f2", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "#ef4444" }}>
                            {i+1}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{item.item}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>{item.category}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "#ef4444" }}>{item.qty_sold} sold</div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>₹{Number(item.revenue).toLocaleString()}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* All items bar chart */}
                {itemData.length > 0 && (
                  <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #f3f4f6" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 12 }}>All Items — Qty Sold</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={itemData.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="item" tick={{ fontSize: 9 }} width={80} />
                        <Tooltip formatter={(val: any) => [val, "Qty Sold"]} />
                        <Bar dataKey="qty_sold" fill="#f97316" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* ── DAYS TAB ── */}
            {activeTab === "days" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Best / Worst day cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ background: "#f0fdf4", borderRadius: 16, padding: 16, border: "1px solid #bbf7d0" }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>🏆</div>
                    <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, marginBottom: 4 }}>BEST DAY</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>
                      {bestDay ? DAY_SHORT[bestDay.day_name] || bestDay.day_name.trim() : "—"}
                    </div>
                    <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 700, marginTop: 2 }}>
                      ₹{bestDay ? Number(bestDay.revenue).toFixed(0) : 0}
                    </div>
                  </div>
                  <div style={{ background: "#fef2f2", borderRadius: 16, padding: 16, border: "1px solid #fecaca" }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>📉</div>
                    <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, marginBottom: 4 }}>LOWEST DAY</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>
                      {worstDay ? DAY_SHORT[worstDay.day_name] || worstDay.day_name.trim() : "—"}
                    </div>
                    <div style={{ fontSize: 13, color: "#ef4444", fontWeight: 700, marginTop: 2 }}>
                      ₹{worstDay ? Number(worstDay.revenue).toFixed(0) : 0}
                    </div>
                  </div>
                </div>

                {/* Day of week bar chart */}
                {dayData.length > 0 && (
                  <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #f3f4f6" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 12 }}>Revenue by Day of Week</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={dayData.map(d => ({ ...d, day: DAY_SHORT[d.day_name] || d.day_name.trim() }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(val: any) => [`₹${Number(val).toFixed(0)}`, "Revenue"]} />
                        <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                          {dayData.map((entry, i) => (
                            <Cell key={i} fill={entry === bestDay ? "#16a34a" : entry === worstDay ? "#ef4444" : "#f97316"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, fontSize: 11, color: "#64748b" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#16a34a" }} /> Best day</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444" }} /> Lowest day</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#f97316" }} /> Normal</span>
                    </div>
                  </div>
                )}

                {/* Day by day breakdown */}
                {dayData.length > 0 && (
                  <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #f3f4f6" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 12 }}>Day by Day Breakdown</div>
                    {dayData.map((day, i) => {
                      const maxRevenue = Math.max(...dayData.map(d => Number(d.revenue)));
                      const pct = maxRevenue > 0 ? (Number(day.revenue) / maxRevenue) * 100 : 0;
                      const isBest  = day === bestDay;
                      const isWorst = day === worstDay;
                      return (
                        <div key={i} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", minWidth: 32 }}>
                                {DAY_SHORT[day.day_name] || day.day_name.trim()}
                              </span>
                              {isBest  && <span style={{ background: "#f0fdf4", color: "#16a34a", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6 }}>🏆 Best</span>}
                              {isWorst && <span style={{ background: "#fef2f2", color: "#ef4444", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6 }}>📉 Low</span>}
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: isBest ? "#16a34a" : isWorst ? "#ef4444" : "#111827" }}>
                                ₹{Number(day.revenue).toFixed(0)}
                              </span>
                              <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 6 }}>{day.orders} orders</span>
                            </div>
                          </div>
                          <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: isBest ? "#16a34a" : isWorst ? "#ef4444" : "#f97316", borderRadius: 4 }} />
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

                {/* Generate button */}
                {!aiGenerated && (
                  <div style={{ background: "linear-gradient(135deg, #1e293b, #334155)", borderRadius: 20, padding: 24, textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: "#f1f5f9", marginBottom: 8 }}>AI Business Analyst</div>
                    <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20, lineHeight: 1.5 }}>
                      Get AI-powered suggestions to boost your sales, improve low-performing items and increase revenue on slow days
                    </div>
                    <button onClick={generateAISuggestions} disabled={aiLoading || itemData.length === 0}
                      style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 12, padding: "14px 28px", cursor: aiLoading ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 15, opacity: aiLoading ? 0.7 : 1, boxShadow: "0 4px 12px rgba(249,115,22,0.4)" }}>
                      {aiLoading ? "🔄 Analyzing..." : "✨ Generate AI Suggestions"}
                    </button>
                    {itemData.length === 0 && (
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>
                        No sales data available. Complete some orders first.
                      </div>
                    )}
                  </div>
                )}

                {/* AI Chat */}
                {aiGenerated && (
                  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f3f4f6", overflow: "hidden" }}>
                    {/* Chat header */}
                    <div style={{ background: "#1e293b", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 32, height: 32, background: "#f97316", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>AI Business Analyst</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>Based on your {period} data</div>
                        </div>
                      </div>
                      <button onClick={() => { setAiChat([]); setAiGenerated(false); }}
                        style={{ background: "#334155", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "#94a3b8" }}>
                        Reset
                      </button>
                    </div>

                    {/* Messages */}
                    <div style={{ padding: 16, maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                      {aiLoading && aiChat.length === 0 && (
                        <div style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>
                          <div style={{ fontSize: 24, marginBottom: 8 }}>🔄</div>
                          Analyzing your sales data...
                        </div>
                      )}
                      {aiChat.map((msg, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                          <div style={{
                            maxWidth: "90%", padding: "12px 16px",
                            borderRadius: msg.role === "user" ? "16px 16px 2px 16px" : "16px 16px 16px 2px",
                            background: msg.role === "user" ? "#f97316" : "#f8fafc",
                            color: msg.role === "user" ? "#fff" : "#111827",
                            fontSize: 13, lineHeight: 1.6,
                            border: msg.role === "assistant" ? "1px solid #e2e8f0" : "none",
                            whiteSpace: "pre-wrap",
                          }}>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                      {aiLoading && aiChat.length > 0 && (
                        <div style={{ display: "flex", justifyContent: "flex-start" }}>
                          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: "10px 14px", fontSize: 13, color: "#94a3b8" }}>
                            Thinking...
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Quick questions */}
                    {aiChat.length > 0 && !aiLoading && (
                      <div style={{ padding: "0 16px 12px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {[
                          "What offers for slow days?",
                          "How to improve least selling items?",
                          "Best combo to suggest?",
                          "How to increase avg bill?",
                        ].map(q => (
                          <button key={q} onClick={() => setAiMsg(q)}
                            style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 20, padding: "6px 12px", cursor: "pointer", fontSize: 11, color: "#374151", fontWeight: 600 }}>
                            {q}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Input */}
                    <div style={{ padding: "12px 16px", borderTop: "1px solid #f3f4f6", display: "flex", gap: 8 }}>
                      <input type="text" placeholder="Ask anything about your sales..."
                        value={aiMsg}
                        onChange={e => setAiMsg(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleAiChat()}
                        style={{ flex: 1, border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontSize: 13, outline: "none" }}
                      />
                      <button onClick={handleAiChat} disabled={aiLoading || !aiMsg.trim()}
                        style={{ background: "#f97316", border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, opacity: aiLoading || !aiMsg.trim() ? 0.6 : 1 }}>
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