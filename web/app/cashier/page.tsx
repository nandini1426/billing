"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface PendingOrder {
  id: string;
  order_number: string;
  table_id: string;
  grand_total: number;
  items: any[];
  created_at: string;
}

interface Table {
  id: string;
  label: string;
  status: string;
}

export default function CashierPage() {
  const router = useRouter();
  const { user, init } = useAuthStore();
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [tables,        setTables]        = useState<Table[]>([]);
  const [showFastBilling, setShowFastBilling] = useState(false);

  useEffect(() => { init(); }, []);
  useEffect(() => {
    if (user && user.role === "manager") {
      toast.error("Access denied");
      router.push("/dashboard");
    }
  }, [user]);

  useEffect(() => {
    fetchPendingOrders();
    fetchTables();
  }, []);

  const fetchPendingOrders = async () => {
    try {
      const res = await api.get("/orders?status=pending&order_type=table");
      setPendingOrders(res.data.filter((o: any) => o.table_id));
    } catch { toast.error("Failed to load pending orders"); }
  };

  const fetchTables = async () => {
    try {
      const res = await api.get("/tables");
      setTables(res.data);
    } catch { toast.error("Failed to load tables"); }
  };

  const getTableLabel = (tableId: string) =>
    tables.find(t => t.id === tableId)?.label || "—";

  const handleFastBillingTable = async (order: PendingOrder) => {
    try {
      const res = await api.get(`/orders/${order.id}`);
      const fullOrder = res.data;
      const itemsParam = encodeURIComponent(JSON.stringify(fullOrder.items));
      router.push(
        `/cashier/order?mode=fast&orderId=${order.id}&tableLabel=${getTableLabel(order.table_id)}&tableId=${order.table_id}&savedItems=${itemsParam}`
      );
    } catch {
      toast.error("Failed to load order");
    }
  };

  if (!user) return null;

  const modes = [
    { id: "table",    label: "Table Booking", icon: "🪑", desc: "Dine-in orders",         color: "#fff7ed", border: "#fed7aa", textColor: "#ea580c" },
    { id: "takeaway", label: "Take Away",      icon: "🛍️", desc: "Quick orders to go",     color: "#eff6ff", border: "#bfdbfe", textColor: "#2563eb" },
    { id: "delivery", label: "Delivery",       icon: "🛵", desc: "Home delivery",          color: "#f0fdf4", border: "#bbf7d0", textColor: "#16a34a" },
    { id: "fast",     label: "Fast Billing",   icon: "⚡", desc: "Bill manager orders",   color: "#faf5ff", border: "#e9d5ff", textColor: "#7c3aed" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)" }}>

      {/* Header */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #e2e8f0",
        padding: "0 16px", height: 70, display: "flex",
        alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, position: "sticky", top: 0, zIndex: 10,
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => showFastBilling ? setShowFastBilling(false) : router.push("/dashboard")}
            style={{ background: "#f1f5f9", border: "none", cursor: "pointer", fontSize: 16, color: "#374151", padding: "10px 16px", borderRadius: 10, fontWeight: 700 }}>
            ← Back
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 36, height: 36, background: "#f97316", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🍽️</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: "#111827", lineHeight: 1.2 }}>Cashier Control</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Select billing mode</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>{user.username}</div>
            <div style={{ fontSize: 11, color: "#f97316", fontWeight: 600, textTransform: "capitalize" }}>{user.role}</div>
          </div>
          <div style={{ width: 36, height: 36, background: "#fff7ed", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#f97316", border: "2px solid #fed7aa", flexShrink: 0 }}>
            {user.username.charAt(0).toUpperCase()}
          </div>
          <button
            onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); router.push('/login'); }}
            title="Logout"
            style={{ width: 40, height: 40, borderRadius: "50%", background: "#fee2e2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      <main style={{ padding: "20px 16px", maxWidth: 600, margin: "0 auto" }}>

        {/* Mode selection */}
        {!showFastBilling && (
          <>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>Choose Billing Mode</h2>
              <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>Select how you want to take the order</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {modes.map(mode => (
                <button key={mode.id}
                  onClick={() => {
                    if (mode.id === "fast") setShowFastBilling(true);
                    else if (mode.id === "table") router.push("/cashier/table");
                    else router.push(`/cashier/order?mode=${mode.id}`);
                  }}
                  style={{
                    background: "#fff", border: `1px solid ${mode.border}`,
                    borderRadius: 16, padding: "16px 20px",
                    display: "flex", alignItems: "center", gap: 16,
                    cursor: "pointer", textAlign: "left",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    width: "100%",
                  }}>
                  <div style={{ width: 52, height: 52, background: mode.color, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>
                    {mode.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "#111827", marginBottom: 2 }}>{mode.label}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{mode.desc}</div>
                  </div>
                  <div style={{ color: mode.textColor, fontWeight: 700, fontSize: 22, flexShrink: 0 }}>›</div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Fast billing */}
        {showFastBilling && (
          <>
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>⚡ Fast Billing</h2>
                <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>Manager saved orders ready for billing</p>
              </div>
              <button onClick={fetchPendingOrders}
                style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#ea580c", fontWeight: 600 }}>
                🔄 Refresh
              </button>
            </div>

            {pendingOrders.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", border: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>No pending orders</div>
                <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>Manager needs to save orders first</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendingOrders.map(order => (
                  <button key={order.id} onClick={() => handleFastBillingTable(order)}
                    style={{ background: "#fff", borderRadius: 16, border: "1px solid #f3f4f6", padding: "16px 20px", textAlign: "left", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 24 }}>🪑</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>{getTableLabel(order.table_id)}</span>
                      </div>
                      <span style={{ background: "#fef9c3", color: "#854d0e", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>Pending</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Order #{order.order_number}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: "#f97316" }}>₹{order.grand_total}</span>
                      <span style={{ background: "#faf5ff", color: "#7c3aed", border: "1px solid #e9d5ff", borderRadius: 10, padding: "6px 16px", fontSize: 13, fontWeight: 700 }}>
                        ⚡ Bill This →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}