"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Table {
  id: string;
  label: string;
  capacity: number;
  status: "available" | "occupied" | "reserved";
}

export default function TableSelectionPage() {
  const router = useRouter();
  const { user, init } = useAuthStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);

  useEffect(() => { init(); }, []);
  useEffect(() => { if (!user) router.push("/login"); }, [user]);

  useEffect(() => {
    fetchTables();
    fetchPendingOrders();
  }, []);

  const fetchTables = async () => {
    try {
      const res = await api.get("/tables");
      setTables(res.data);
    } catch { toast.error("Failed to load tables"); }
    finally { setLoading(false); }
  };

  const fetchPendingOrders = async () => {
    try {
      const res = await api.get("/orders?status=pending");
      setPendingOrders(res.data);
    } catch { console.error("Failed to load pending orders"); }
  };

  const handleTableSelect = (table: Table) => {
    if (table.status === "occupied") {
      const existing = pendingOrders.find(o => o.table_id === table.id);
      if (existing) {
        const itemsParam = encodeURIComponent(JSON.stringify(existing.items));
        router.push(
          `/cashier/order?mode=table&tableId=${table.id}&tableLabel=${table.label}&orderId=${existing.id}&savedItems=${itemsParam}`
        );
        return;
      }
    }
    router.push(`/cashier/order?mode=table&tableId=${table.id}&tableLabel=${table.label}`);
  };

  if (!user) return null;

  const available = tables.filter(t => t.status === "available").length;
  const occupied  = tables.filter(t => t.status === "occupied").length;

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
            onClick={() => router.push("/cashier")}
            style={{ background: "#f1f5f9", border: "none", cursor: "pointer", fontSize: 16, color: "#374151", padding: "10px 16px", borderRadius: 10, fontWeight: 700 }}>
            ← Back
          </button>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#111827", lineHeight: 1.2 }}>🪑 Select Table</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Tap a table to start order</div>
          </div>
        </div>
        <button onClick={() => { fetchTables(); fetchPendingOrders(); }}
          style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 16, color: "#ea580c" }}>
          🔄
        </button>
      </header>

      <main style={{ padding: "20px 16px", maxWidth: 600, margin: "0 auto" }}>

        {/* Stats */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #f3f4f6", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>{available}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Available</div>
          </div>
          <div style={{ flex: 1, background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #f3f4f6", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#ef4444" }}>{occupied}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Occupied</div>
          </div>
          <div style={{ flex: 1, background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #f3f4f6", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>{tables.length}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Total</div>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 12, color: "#64748b" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: "#fff", border: "2px solid #d1d5db" }} />
            Available
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: "#fee2e2", border: "2px solid #fca5a5" }} />
            Occupied
          </span>
        </div>

        {/* Tables grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading tables...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {tables.map(table => (
              <button key={table.id}
                onClick={() => handleTableSelect(table)}
                style={{
                  borderRadius: 14, border: "2px solid",
                  padding: "14px 8px", cursor: "pointer",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 4, transition: "all .15s",
                  background: table.status === "occupied" ? "#fee2e2" : "#fff",
                  borderColor: table.status === "occupied" ? "#fca5a5" : "#e2e8f0",
                }}>
                <span style={{ fontSize: 22 }}>🪑</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: "#111827" }}>{table.label}</span>
                <span style={{ fontSize: 10, color: table.status === "occupied" ? "#ef4444" : "#94a3b8", fontWeight: 600 }}>
                  {table.status === "occupied" ? "busy" : "free"}
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}