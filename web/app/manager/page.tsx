"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";
import LogoutButton from "@/components/LogoutButton";

interface Table {
  id: string; label: string; capacity: number;
  status: "available" | "occupied" | "reserved";
}
interface Category { id: string; name: string; }
interface MenuItem  { id: string; name: string; price: number; }
interface OrderItem { id: string; name: string; price: number; quantity: number; }

export default function ManagerPage() {
  const router = useRouter();
  const { user, init } = useAuthStore();

  const [tables,         setTables]         = useState<Table[]>([]);
  const [selectedTable,  setSelectedTable]  = useState<Table | null>(null);
  const [categories,     setCategories]     = useState<Category[]>([]);
  const [menuItems,      setMenuItems]      = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [orderItems,     setOrderItems]     = useState<OrderItem[]>([]);
  const [saving,         setSaving]         = useState(false);
  const [existingOrders, setExistingOrders] = useState<any[]>([]);
  const [view,           setView]           = useState<"tables" | "order">("tables");
  const [mobileTab,      setMobileTab]      = useState<"menu" | "bill">("menu");

  useEffect(() => { init(); }, []);
  useEffect(() => {
    if (user && user.role === "cashier") {
      toast.error("Access denied");
      router.push("/dashboard");
    }
  }, [user]);

  useEffect(() => {
    fetchTables();
    fetchCategories();
    fetchPendingOrders();
  }, []);

  useEffect(() => {
    if (activeCategory) fetchItems(activeCategory);
  }, [activeCategory]);

  const fetchTables = async () => {
    try {
      const res = await api.get("/tables");
      setTables(res.data);
    } catch { toast.error("Failed to load tables"); }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get("/menu/categories");
      setCategories(res.data);
      if (res.data.length > 0) setActiveCategory(res.data[0].id);
    } catch { toast.error("Failed to load categories"); }
  };

  const fetchItems = async (categoryId: string) => {
    try {
      const res = await api.get(`/menu/categories/${categoryId}/items`);
      setMenuItems(res.data);
    } catch { toast.error("Failed to load items"); }
  };

  const fetchPendingOrders = async () => {
    try {
      const res = await api.get("/orders?status=pending");
      setExistingOrders(res.data);
    } catch { toast.error("Failed to load orders"); }
  };

  const handleTableSelect = async (table: Table) => {
    setSelectedTable(table);
    setOrderItems([]);
    if (table.status === "occupied") {
      const existing = existingOrders.find(o => o.table_id === table.id);
      if (existing) {
        try {
          const res = await api.get(`/orders/${existing.id}`);
          const order = res.data;
          if (order.items && order.items[0] !== null) {
            setOrderItems(order.items.map((item: any) => ({
              id: item.item_id, name: item.name,
              price: Number(item.unit_price), quantity: Number(item.quantity),
            })));
          }
          toast.success(`Loaded order for ${table.label}`);
        } catch { toast.error("Failed to load existing order"); }
      }
    }
    setView("order");
    setMobileTab("menu");
  };

  const addItem = (item: MenuItem) => {
    setOrderItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) setOrderItems(prev => prev.filter(i => i.id !== id));
    else setOrderItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  };

  const getQty = (id: string) => orderItems.find(i => i.id === id)?.quantity ?? 0;
  const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleSaveOrder = async () => {
    if (!selectedTable) return toast.error("Select a table first");
    if (!orderItems.length) return toast.error("No items added");
    setSaving(true);
    try {
      await api.post("/orders", {
        table_id: selectedTable.id, order_type: "table",
        items: orderItems.map(i => ({ menu_item_id: i.id, quantity: i.quantity })),
        cgst: 2.5, sgst: 2.5,
      });
      toast.success(`Order saved for ${selectedTable.label}!`);
      setOrderItems([]);
      setSelectedTable(null);
      setView("tables");
      fetchTables();
      fetchPendingOrders();
    } catch (err: any) {
      toast.error(err.error || "Failed to save order");
    } finally { setSaving(false); }
  };

  if (!user) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f8fafc" }}>

      {/* Header */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #e2e8f0",
        padding: "0 16px", height: 54, display: "flex",
        alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => view === "order"
              ? (setView("tables"), setSelectedTable(null), setOrderItems([]))
              : router.push("/dashboard")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#64748b", padding: "4px 8px" }}>
            ← {view === "order" ? "Tables" : "Back"}
          </button>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
            🧑‍💼 Manager
            {selectedTable && <span style={{ color: "#f97316" }}> — {selectedTable.label}</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => { fetchTables(); fetchPendingOrders(); }}
            style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12, color: "#ea580c", fontWeight: 600 }}>
            🔄
          </button>
          <LogoutButton />
        </div>
      </header>

      {/* TABLE SELECTION VIEW */}
      {view === "tables" && (
        <main style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>Select a Table</h2>
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Tap a table to start or edit an order</p>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 12, color: "#64748b" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: "#fff", border: "1.5px solid #d1d5db" }} /> Available
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: "#fee2e2", border: "1.5px solid #fca5a5" }} /> Occupied
            </span>
          </div>

          {/* Tables grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {tables.map(table => (
              <button key={table.id} onClick={() => handleTableSelect(table)}
                style={{
                  borderRadius: 14, border: "2px solid",
                  padding: "14px 8px", cursor: "pointer",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 4,
                  background: table.status === "occupied" ? "#fee2e2"
                    : selectedTable?.id === table.id ? "#f97316" : "#fff",
                  borderColor: table.status === "occupied" ? "#fca5a5"
                    : selectedTable?.id === table.id ? "#f97316" : "#e2e8f0",
                  color: selectedTable?.id === table.id ? "#fff" : "#111827",
                }}>
                <span style={{ fontSize: 20 }}>🪑</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{table.label}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>
                  {table.status === "occupied" ? "busy" : "free"}
                </span>
              </button>
            ))}
          </div>
        </main>
      )}

      {/* ORDER VIEW */}
      {view === "order" && selectedTable && (
        <>
          {/* Mobile tab bar */}
          <div style={{ display: "flex", background: "#1e293b", flexShrink: 0 }}>
            {(["menu", "bill"] as const).map(tab => (
              <button key={tab} onClick={() => setMobileTab(tab)}
                style={{
                  flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                  background: mobileTab === tab ? "#f97316" : "none",
                  color: mobileTab === tab ? "#fff" : "#94a3b8",
                  fontWeight: 700, fontSize: 13,
                }}>
                {tab === "menu" ? "🍽️ Menu" : `🧾 Order (${orderItems.length})`}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

            {/* Menu panel */}
            {mobileTab === "menu" && (
              <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

                {/* Categories */}
                <aside style={{ width: 90, background: "#fff", borderRight: "1px solid #e2e8f0", overflowY: "auto", flexShrink: 0 }}>
                  {categories.map(cat => (
                    <button key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      style={{
                        width: "100%", padding: "12px 8px", border: "none", cursor: "pointer",
                        textAlign: "center", fontSize: 11, fontWeight: activeCategory === cat.id ? 700 : 500,
                        background: activeCategory === cat.id ? "#fff7ed" : "none",
                        color: activeCategory === cat.id ? "#ea580c" : "#374151",
                        borderLeft: activeCategory === cat.id ? "3px solid #f97316" : "3px solid transparent",
                        lineHeight: 1.3,
                      }}>
                      {cat.name}
                    </button>
                  ))}
                </aside>

                {/* Items */}
                <section style={{ flex: 1, overflowY: "auto", padding: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    {menuItems.map(item => {
                      const qty = getQty(item.id);
                      return (
                        <div key={item.id}
                          style={{
                            background: qty > 0 ? "#fff7ed" : "#fff",
                            border: qty > 0 ? "2px solid #f97316" : "1px solid #e2e8f0",
                            borderRadius: 12, padding: 12,
                            position: "relative",
                          }}>
                          {qty > 0 && (
                            <div style={{ position: "absolute", top: 6, right: 6, background: "#f97316", color: "#fff", borderRadius: 20, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                              {qty}
                            </div>
                          )}
                          <div style={{ fontWeight: 600, fontSize: 12, color: "#1e293b", marginBottom: 4, paddingRight: qty > 0 ? 22 : 0, lineHeight: 1.3 }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: 15, color: "#ea580c", fontWeight: 800, marginBottom: 8 }}>₹{item.price}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button onClick={() => updateQty(item.id, qty - 1)} disabled={qty === 0}
                              style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #e2e8f0", background: qty > 0 ? "#fee2e2" : "#f1f5f9", cursor: qty > 0 ? "pointer" : "not-allowed", fontSize: 16, fontWeight: 700, color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              −
                            </button>
                            <span style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 14 }}>{qty}</span>
                            <button onClick={() => addItem(item)}
                              style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "#f97316", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {/* Bill panel */}
            {mobileTab === "bill" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                {/* Order items */}
                <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                    Order — {selectedTable.label}
                  </div>
                  {orderItems.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#cbd5e1", paddingTop: 40 }}>
                      <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
                      <div style={{ fontSize: 13 }}>No items added yet</div>
                      <button onClick={() => setMobileTab("menu")}
                        style={{ marginTop: 12, background: "#f97316", color: "#fff", border: "none", borderRadius: 10, padding: "8px 20px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                        Add Items
                      </button>
                    </div>
                  ) : (
                    orderItems.map(item => (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>₹{item.price} × {item.quantity} = <span style={{ color: "#ea580c", fontWeight: 700 }}>₹{Math.round(item.price * item.quantity)}</span></div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button onClick={() => updateQty(item.id, item.quantity - 1)}
                            style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid #e2e8f0", background: "#fee2e2", cursor: "pointer", fontSize: 16, color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                          <span style={{ width: 24, textAlign: "center", fontSize: 13, fontWeight: 700 }}>{item.quantity}</span>
                          <button onClick={() => updateQty(item.id, item.quantity + 1)}
                            style={{ width: 26, height: 26, borderRadius: 7, border: "none", background: "#f97316", cursor: "pointer", fontSize: 16, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Totals + Save */}
                {orderItems.length > 0 && (
                  <div style={{ padding: "12px 16px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#64748b", marginBottom: 4 }}>
                      <span>Items: {orderItems.reduce((s, i) => s + i.quantity, 0)}</span>
                      <span>Subtotal: <strong style={{ color: "#f97316" }}>₹{Math.round(subtotal)}</strong></span>
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>GST will be added at billing</div>
                    <button onClick={handleSaveOrder} disabled={saving}
                      style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: saving ? "#fed7aa" : "#f97316", color: "#fff", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontSize: 15 }}>
                      {saving ? "Saving..." : "💾 Save Order"}
                    </button>
                    <button onClick={() => setOrderItems([])}
                      style={{ width: "100%", padding: "10px 0", borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, cursor: "pointer", fontSize: 13, marginTop: 8 }}>
                      🗑️ Clear All
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}