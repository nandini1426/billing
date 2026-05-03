"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Order {
  id: string;
  order_number: string;
  order_type: string;
  status: string;
  table_id: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  cgst: number;
  sgst: number;
  discount_pct: number;
  discount_fixed: number;
  delivery_fee: number;
  grand_total: number;
  is_printed: boolean;
  created_at: string;
  items: any[];
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, init } = useAuthStore();

  const [orders,        setOrders]        = useState<Order[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filterStatus,  setFilterStatus]  = useState("");
  const [filterType,    setFilterType]    = useState("");
  const [filterDate,    setFilterDate]    = useState("");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showFilters,   setShowFilters]   = useState(false);

  useEffect(() => { init(); }, []);
  useEffect(() => { if (!user) router.push("/login"); }, [user]);
  useEffect(() => { fetchOrders(); }, [filterStatus, filterType, filterDate]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append("status",     filterStatus);
      if (filterType)   params.append("order_type", filterType);
      if (filterDate)   params.append("date",       filterDate);
      const res = await api.get(`/orders?${params.toString()}`);
      setOrders(res.data);
    } catch {
      toast.error("Failed to load orders");
    } finally { setLoading(false); }
  };

  const handleCancelOrder = async (id: string) => {
    if (!window.confirm("Cancel this order?")) return;
    try {
      await api.delete(`/orders/${id}`);
      toast.success("Order cancelled");
      fetchOrders();
    } catch { toast.error("Failed to cancel order"); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":  return { bg: "#f0fdf4", color: "#16a34a" };
      case "pending":    return { bg: "#fefce8", color: "#ca8a04" };
      case "preparing":  return { bg: "#eff6ff", color: "#2563eb" };
      case "cancelled":  return { bg: "#fee2e2", color: "#ef4444" };
      default:           return { bg: "#f1f5f9", color: "#64748b" };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "table":    return "🪑";
      case "takeaway": return "🛍️";
      case "delivery": return "🛵";
      case "fast":     return "⚡";
      default:         return "📋";
    }
  };

  const filtered = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(q) ||
      o.customer_name?.toLowerCase().includes(q) ||
      o.customer_phone?.includes(q)
    );
  });

  const totalRevenue = filtered
    .filter(o => o.status === "completed")
    .reduce((s, o) => s + Number(o.grand_total), 0);

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
          <div style={{ fontWeight: 800, fontSize: 17, color: "#111827" }}>📋 Orders</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowFilters(!showFilters)}
            style={{ background: showFilters ? "#f97316" : "#f1f5f9", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 13, color: showFilters ? "#fff" : "#374151", fontWeight: 600 }}>
            🔽 Filter
          </button>
          <button onClick={fetchOrders}
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

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>🔍</span>
          <input type="text" placeholder="Search by name, phone, order no..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: "100%", padding: "12px 14px 12px 38px", border: "1.5px solid #e5e7eb", borderRadius: 12, fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box" as any }}
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, border: "1px solid #f3f4f6", display: "flex", flexDirection: "column", gap: 10 }}>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff" }}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff" }}>
              <option value="">All Types</option>
              <option value="table">Table</option>
              <option value="takeaway">Takeaway</option>
              <option value="delivery">Delivery</option>
              <option value="fast">Fast Billing</option>
            </select>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff" }}
            />
            <button onClick={() => { setFilterStatus(""); setFilterType(""); setFilterDate(""); setSearchQuery(""); }}
              style={{ width: "100%", padding: "10px 0", background: "#f1f5f9", border: "none", borderRadius: 10, fontSize: 13, color: "#64748b", fontWeight: 600, cursor: "pointer" }}>
              Clear Filters
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Total Orders",  value: filtered.length,                                          bg: "#eff6ff", color: "#2563eb" },
            { label: "Completed",     value: filtered.filter(o => o.status === "completed").length,    bg: "#f0fdf4", color: "#16a34a" },
            { label: "Pending",       value: filtered.filter(o => o.status === "pending").length,      bg: "#fefce8", color: "#ca8a04" },
            { label: "Revenue",       value: `₹${totalRevenue.toLocaleString()}`,                      bg: "#fff7ed", color: "#ea580c" },
          ].map((card, i) => (
            <div key={i} style={{ background: card.bg, borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: card.color, fontWeight: 600, opacity: 0.8, marginBottom: 4 }}>{card.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Orders list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
            <div>No orders found</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(order => {
              const statusStyle = getStatusColor(order.status);
              return (
                <div key={order.id}
                  style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #f3f4f6", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>#{order.order_number}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                        {getTypeIcon(order.order_type)} {order.order_type}
                        {order.customer_name ? ` · ${order.customer_name}` : ""}
                      </div>
                    </div>
                    <span style={{ background: statusStyle.bg, color: statusStyle.color, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, textTransform: "capitalize" }}>
                      {order.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#f97316" }}>₹{order.grand_total}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                        {order.items?.[0] !== null ? order.items?.length : 0} items · {new Date(order.created_at).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setSelectedOrder(order)}
                        style={{ background: "#eff6ff", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, color: "#2563eb", fontWeight: 600 }}>
                        View
                      </button>
                      {order.status !== "cancelled" && order.status !== "completed" && (
                        <button onClick={() => handleCancelOrder(order.id)}
                          style={{ background: "#fee2e2", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Order detail modal */}
      {selectedOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 600, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontWeight: 800, fontSize: 17, margin: 0 }}>Order #{selectedOrder.order_number}</h3>
              <button onClick={() => setSelectedOrder(null)}
                style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            <div style={{ background: "#f8fafc", borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#64748b" }}>Type</span>
                <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{selectedOrder.order_type}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#64748b" }}>Status</span>
                <span style={{ fontWeight: 700, textTransform: "capitalize", color: getStatusColor(selectedOrder.status).color }}>
                  {selectedOrder.status}
                </span>
              </div>
              {selectedOrder.customer_name && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: "#64748b" }}>Customer</span>
                  <span style={{ fontWeight: 600 }}>{selectedOrder.customer_name}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Date</span>
                <span>{new Date(selectedOrder.created_at).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Items */}
            <div style={{ marginBottom: 14 }}>
              {selectedOrder.items?.filter((i: any) => i !== null).map((item: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #f1f5f9" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>Qty: {item.quantity} × ₹{item.unit_price}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#f97316" }}>₹{item.line_total}</div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: 14, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#64748b" }}>
                <span>Subtotal</span><span>₹{selectedOrder.subtotal}</span>
              </div>
              {Number(selectedOrder.cgst) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#64748b" }}>
                  <span>CGST</span><span>₹{selectedOrder.cgst}</span>
                </div>
              )}
              {Number(selectedOrder.sgst) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#64748b" }}>
                  <span>SGST</span><span>₹{selectedOrder.sgst}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, paddingTop: 10, borderTop: "2px solid #e2e8f0", marginTop: 6 }}>
                <span>Total</span>
                <span style={{ color: "#f97316" }}>₹{selectedOrder.grand_total}</span>
              </div>
            </div>

            <button onClick={() => setSelectedOrder(null)}
              style={{ width: "100%", marginTop: 16, padding: "14px 0", background: "#f1f5f9", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#374151" }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}