"use client";
import { useEffect, useState } from "react";
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
  total_orders: number;
  total_revenue: number;
  avg_bill: number;
  table_orders: number;
  takeaway_orders: number;
  delivery_orders: number;
  fast_orders: number;
}

interface DailyData {
  date: string;
  orders: number;
  revenue: number;
}

interface CategoryData {
  category: string;
  qty_sold: number;
  revenue: number;
}

const COLORS = ["#f97316","#3b82f6","#10b981","#8b5cf6","#ec4899","#f59e0b","#06b6d4"];

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, init } = useAuthStore();

  const [period,       setPeriod]       = useState<"today"|"week"|"month">("today");
  const [summary,      setSummary]      = useState<Summary | null>(null);
  const [dailyData,    setDailyData]    = useState<DailyData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => { init(); }, []);
  useEffect(() => {
    if (user && user.role !== "admin") {
      toast.error("Admin access only");
      router.push("/dashboard");
    }
  }, [user]);
  useEffect(() => { fetchAll(); }, [period]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [summaryRes, dailyRes, categoryRes] = await Promise.all([
        api.get(`/analytics/summary?period=${period}`),
        api.get(`/analytics/daily?days=${period === "today" ? 1 : period === "week" ? 7 : 30}`),
        api.get(`/analytics/categories?period=${period}`),
      ]);
      setSummary(summaryRes.data);
      setDailyData(dailyRes.data);
      setCategoryData(categoryRes.data);
    } catch {
      toast.error("Failed to load analytics");
    } finally { setLoading(false); }
  };

  const orderTypeData = summary ? [
    { name: "Table",    value: Number(summary.table_orders) },
    { name: "Takeaway", value: Number(summary.takeaway_orders) },
    { name: "Delivery", value: Number(summary.delivery_orders) },
    { name: "Fast",     value: Number(summary.fast_orders) },
  ].filter(d => d.value > 0) : [];

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
            { id: "week",  label: "This Week" },
            { id: "month", label: "This Month" },
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

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📊</div>
            Loading analytics...
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Total Orders",  value: summary?.total_orders || 0,                                           icon: "📋", bg: "#eff6ff",  color: "#2563eb" },
                { label: "Total Revenue", value: `₹${Number(summary?.total_revenue || 0).toLocaleString()}`,           icon: "💰", bg: "#f0fdf4",  color: "#16a34a" },
                { label: "Avg Bill",      value: `₹${Math.round(Number(summary?.avg_bill || 0))}`,                    icon: "🧾", bg: "#faf5ff",  color: "#7c3aed" },
                { label: "Categories",    value: categoryData.length,                                                  icon: "📂", bg: "#fff7ed",  color: "#ea580c" },
              ].map((card, i) => (
                <div key={i} style={{ background: card.bg, borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{card.icon}</div>
                  <div style={{ fontSize: 11, color: card.color, fontWeight: 600, opacity: 0.8, marginBottom: 2 }}>{card.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: card.color }}>{card.value}</div>
                </div>
              ))}
            </div>

            {/* Order type breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
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
              <div style={{ background: "#fff", borderRadius: 16, padding: "16px", marginBottom: 16, border: "1px solid #f3f4f6", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 12 }}>Revenue Trend</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }}
                      tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(val: any) => [`₹${val}`, "Revenue"]}
                      labelFormatter={d => new Date(d).toLocaleDateString('en-IN')} />
                    <Line type="monotone" dataKey="revenue" stroke="#f97316"
                      strokeWidth={2.5} dot={{ fill: "#f97316", r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Category bar chart */}
            {categoryData.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 16, padding: "16px", marginBottom: 16, border: "1px solid #f3f4f6", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 12 }}>Sales by Category</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(val: any) => [`₹${val}`, "Revenue"]} />
                    <Bar dataKey="revenue" fill="#f97316" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Pie chart */}
            {orderTypeData.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 16, padding: "16px", marginBottom: 16, border: "1px solid #f3f4f6", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 12 }}>Orders by Type</div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={orderTypeData} cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80}
                      paddingAngle={4} dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={{ stroke: "#94a3b8" }}>
                      {orderTypeData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Category performance table */}
            {categoryData.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #f3f4f6", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>Category Performance</div>
                </div>
                {categoryData.map((cat, i) => {
                  const totalRevenue = categoryData.reduce((s, c) => s + Number(c.revenue), 0);
                  const share = totalRevenue > 0 ? Math.round(Number(cat.revenue) / totalRevenue * 100) : 0;
                  return (
                    <div key={i} style={{ padding: "12px 16px", borderBottom: i < categoryData.length - 1 ? "1px solid #f8fafc" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS[i % COLORS.length] }} />
                          <span style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{cat.category}</span>
                        </div>
                        <span style={{ fontWeight: 800, fontSize: 14, color: "#f97316" }}>
                          ₹{Number(cat.revenue).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${share}%`, height: "100%", background: COLORS[i % COLORS.length], borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 30 }}>{share}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {categoryData.length === 0 && dailyData.length === 0 && (
              <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>No data for this period</div>
                <div style={{ fontSize: 13 }}>Complete some orders to see analytics</div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}