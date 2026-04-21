"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useAuthStore from "@/store/authStore";
import useOrderStore from "@/store/orderStore";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { useCustomer, Customer } from "@/lib/useCustomer";

function numberToWords(num: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven",
    "Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen",
    "Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty",
    "Sixty","Seventy","Eighty","Ninety"];
  if (num === 0) return "Zero";
  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " "+ones[n%10] : "");
    if (n < 1000) return ones[Math.floor(n/100)] + " Hundred" + (n%100 ? " "+convert(n%100) : "");
    if (n < 100000) return convert(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " "+convert(n%1000) : "");
    return convert(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " "+convert(n%100000) : "");
  }
  return convert(Math.floor(num));
}

interface Category { id: string; name: string; icon_url: string; }
interface MenuItem  { id: string; name: string; price: number; category_id: string; }
interface Cashier   { id: string; name: string; }
interface RestaurantSettings {
  name: string; address: string; contact: string;
  gstin: string; upi_id: string;
  service_charge: number; footer_text: string;
}

export default function OrderPageInner() {
  const router     = useRouter();
  const params     = useSearchParams();
  const mode       = params.get("mode") || "table";
  const tableId    = params.get("tableId") || null;
  const tableLabel = params.get("tableLabel") || "";
  const [mobileTab, setMobileTab] = useState<"menu" | "bill">("menu");

  const { user, init } = useAuthStore();
  const {
    currentOrder, addItem, addItemWithQty,
    removeItem, updateQty, clearOrder, calcBill
  } = useOrderStore();

  const { suggestions, searchCustomers, clearSuggestions } = useCustomer();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Menu state
  const [categories,      setCategories]      = useState<Category[]>([]);
  const [menuItems,       setMenuItems]       = useState<MenuItem[]>([]);
  const [allItems,        setAllItems]        = useState<MenuItem[]>([]);
  const [activeCategory,  setActiveCategory]  = useState<string | null>(null);
  const [searchQuery,     setSearchQuery]     = useState("");
  const [billSearch,      setBillSearch]      = useState("");
  const [kotSearch,       setKotSearch]       = useState("");

  // Bill state
  const [gstEnabled,      setGstEnabled]      = useState(true);
  const [discountPct,     setDiscountPct]     = useState(0);
  const [discountFixed,   setDiscountFixed]   = useState(0);
  const [deliveryFee,     setDeliveryFee]     = useState(mode === "delivery" ? 40 : 0);
  const [saving,          setSaving]          = useState(false);
  const [savedId,         setSavedId]         = useState<string | null>(params.get("orderId") || null);
  const [orderNumber,     setOrderNumber]     = useState<string>("");
  const [showReceipt,     setShowReceipt]     = useState(false);

  // Customer state
  const [customerName,    setCustomerName]    = useState("");
  const [customerPhone,   setCustomerPhone]   = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState("");
  const [cashiers,        setCashiers]        = useState<Cashier[]>([]);

  // Support state
  const [showSupport,     setShowSupport]     = useState(false);
  const [supportMsg,      setSupportMsg]      = useState("");
  const [supportChat,     setSupportChat]     = useState<{role: string; text: string}[]>([]);
  const [supportLoading,  setSupportLoading]  = useState(false);

  // Restaurant settings
  const [restaurantSettings, setRestaurantSettings] = useState<RestaurantSettings>({
    name: "MY RESTAURANT", address: "", contact: "",
    gstin: "", upi_id: "", service_charge: 0,
    footer_text: "Thank you! Visit again",
  });

  useEffect(() => { init(); }, []);
  useEffect(() => { if (!user) router.push("/login"); }, [user]);

  useEffect(() => {
    const savedItems = params.get("savedItems");
    clearOrder();
    if (savedItems) {
      try {
        const items = JSON.parse(decodeURIComponent(savedItems));
        if (items && items.length > 0 && items[0] !== null) {
          items.forEach((item: any) => {
            addItemWithQty({
              id: item.item_id, name: item.name,
              price: Number(item.unit_price), quantity: Number(item.quantity),
            });
          });
        }
      } catch (e) { console.error("Failed to parse saved items", e); }
    }
    fetchCategories();
    fetchAllItems();
    fetchRestaurantData();
  }, []);

  useEffect(() => {
    if (activeCategory) fetchItems(activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "s") { e.preventDefault(); handleSave(); }
        if (e.key === "p") { e.preventDefault(); setShowReceipt(true); }
        if (e.key === "z") { e.preventDefault(); handleUndo(); }
      }
      if (e.key === "Escape") handleCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentOrder]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [supportChat]);

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

  const fetchAllItems = async () => {
    try {
      const res = await api.get("/menu/items");
      setAllItems(res.data);
    } catch { console.error("Failed to load all items"); }
  };

  const fetchRestaurantData = async () => {
    try {
      const [settingsRes, cashiersRes] = await Promise.all([
        api.get("/settings"),
        api.get("/settings/cashiers"),
      ]);
      const s = settingsRes.data;
      setRestaurantSettings({
        name:           s.name           || "MY RESTAURANT",
        address:        s.address        || "",
        contact:        s.contact        || "",
        gstin:          s.gstin          || "",
        upi_id:         s.upi_id         || "",
        service_charge: s.service_charge || 0,
        footer_text:    s.footer_text    || "Thank you! Visit again",
      });
      setCashiers(cashiersRes.data);
    } catch { console.error("Failed to load restaurant data"); }
  };

  const bill = calcBill(discountPct, discountFixed, gstEnabled, deliveryFee);
  const serviceChargeAmt = restaurantSettings.service_charge > 0
    ? Math.round(bill.afterDiscount * restaurantSettings.service_charge / 100 * 100) / 100 : 0;
  const roundOff = bill.grandTotal - (bill.afterDiscount + serviceChargeAmt + bill.cgst + bill.sgst);

  const displayedItems = searchQuery.trim()
    ? allItems.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : menuItems;

  const handleSave = async () => {
    if (!currentOrder.length) return toast.error("No items in order");
    if (customerPhone && customerPhone.length !== 10)
      return toast.error("Phone must be 10 digits");
    setSaving(true);
    try {
      const res = await api.post("/orders", {
        table_id: tableId, order_type: mode,
        items: currentOrder.map(i => ({ menu_item_id: i.id, quantity: i.quantity })),
        cgst: gstEnabled ? 2.5 : 0, sgst: gstEnabled ? 2.5 : 0,
        discount_pct: discountPct, discount_fixed: discountFixed,
        delivery_fee: deliveryFee,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
      });
      setSavedId(res.data.order.id);
      setOrderNumber(res.data.order.order_number);
      toast.success(`Order ${res.data.order.order_number} saved!`);
    } catch (err: any) {
      toast.error(err.error || "Failed to save order");
    } finally { setSaving(false); }
  };

  const handleSaveAndPrint = async () => {
    if (!currentOrder.length) return toast.error("No items in order");
    if (customerPhone && customerPhone.length !== 10)
      return toast.error("Phone must be 10 digits");
    setSaving(true);
    try {
      const res = await api.post("/orders", {
        table_id: tableId, order_type: mode,
        items: currentOrder.map(i => ({ menu_item_id: i.id, quantity: i.quantity })),
        cgst: gstEnabled ? 2.5 : 0, sgst: gstEnabled ? 2.5 : 0,
        discount_pct: discountPct, discount_fixed: discountFixed,
        delivery_fee: deliveryFee,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
      });
      const orderId = res.data.order.id;
      setSavedId(orderId);
      setOrderNumber(res.data.order.order_number);
      await api.post(`/orders/${orderId}/print`);
      toast.success(`Order ${res.data.order.order_number} saved & printed!`);
      setShowReceipt(true);
    } catch (err: any) {
      toast.error(err.error || "Failed to save & print");
    } finally { setSaving(false); }
  };

  const handleUndo = () => {
    if (!currentOrder.length) return;
    const last = currentOrder[currentOrder.length - 1];
    if (last.quantity > 1) updateQty(last.id, last.quantity - 1);
    else removeItem(last.id);
    toast.success("Undone");
  };

  const handleCancel = () => {
    if (window.confirm("Cancel this order?")) {
      clearOrder();
      if (mode === "table") router.push("/cashier/table");
      else router.push("/cashier");
    }
  };

  const handleSelectCustomer = (c: Customer) => {
    setCustomerName(c.customer_name);
    setCustomerPhone(c.customer_phone);
    clearSuggestions();
    setShowSuggestions(false);
  };

  const getQty = (id: string) =>
    currentOrder.find(i => i.id === id)?.quantity ?? 0;

  const handleBillSearch = async () => {
    if (!billSearch.trim()) return;
    try {
      const res = await api.get(`/orders?search=${billSearch}`);
      if (res.data.length > 0) {
        toast.success(`Found Order #${res.data[0].order_number}`);
      } else {
        toast.error("No order found");
      }
    } catch { toast.error("Failed to search bill"); }
  };

  const handleShareBillLink = () => {
    if (!customerPhone || customerPhone.length !== 10) {
      toast.error("Enter customer phone number first");
      return;
    }
    if (!savedId) {
      toast.error("Save the order first before sharing");
      return;
    }
    const billUrl = `${window.location.origin}/bill?id=${savedId}`;
    const itemsList = currentOrder.map((item, i) =>
      `${i + 1}. ${item.name}\n    Qty: ${item.quantity} × ₹${item.price} = ₹${Math.round(item.price * item.quantity)}`
    ).join("\n");
    const message =
      `Hi ${customerName || "Customer"}, please find your bill.\n\n` +
      `*${restaurantSettings.name}*\n` +
      `${restaurantSettings.address ? restaurantSettings.address + "\n" : ""}` +
      `${restaurantSettings.contact ? "📞 " + restaurantSettings.contact + "\n" : ""}` +
      `\n🧾 *Bill No: ${orderNumber || "—"}*\n` +
      `📅 Date: ${new Date().toLocaleDateString('en-IN')}\n` +
      `🕐 Time: ${new Date().toLocaleTimeString('en-IN')}\n` +
      `${customerName ? "👤 Customer: " + customerName + "\n" : ""}` +
      `\n*Items Ordered:*\n${itemsList}\n` +
      `\n💰 *Bill Summary*\n` +
      `Subtotal: ₹${bill.subtotal}\n` +
      (discountPct > 0 || discountFixed > 0
        ? `Discount: -₹${Math.round((bill.subtotal - bill.afterDiscount) * 100) / 100}\n` : "") +
      (gstEnabled ? `CGST (2.5%): ₹${bill.cgst}\nSGST (2.5%): ₹${bill.sgst}\n` : "") +
      (serviceChargeAmt > 0 ? `Service Charge: ₹${serviceChargeAmt}\n` : "") +
      `\n*💵 Gross Amount: ₹${bill.grandTotal}*\n` +
      `_(${numberToWords(bill.grandTotal)} Rupees only)_\n` +
      `\n🔗 View your bill here:\n${billUrl}\n\n` +
      `_${restaurantSettings.footer_text || "Thank you! Visit again"}_`;
    window.open(`https://wa.me/91${customerPhone}?text=${encodeURIComponent(message)}`, "_blank");
    toast.success("WhatsApp opened with bill link!");
  };

  const handleSupportSend = async () => {
    if (!supportMsg.trim()) return;
    const userMsg = supportMsg.trim();
    setSupportMsg("");
    setSupportChat(prev => [...prev, { role: "user", text: userMsg }]);
    setSupportLoading(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a helpful support assistant for BillEase, a restaurant billing software.
Help users with billing issues, technical problems, and how to use features.
Be concise, friendly and helpful. Answer in 2-3 sentences max.
If the issue cannot be resolved via chat, tell them to contact support@billease.in or call +91-9999999999.
Restaurant name: ${restaurantSettings.name}`,
          messages: [
            ...supportChat.map(m => ({ role: m.role as "user" | "assistant", content: m.text })),
            { role: "user" as const, content: userMsg }
          ],
        })
      });
      const data = await response.json();
      const reply = data.content?.[0]?.text || "Sorry, I could not process your request.";
      setSupportChat(prev => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setSupportChat(prev => [...prev, {
        role: "assistant",
        text: "Sorry, support is temporarily unavailable. Please contact support@billease.in or call +91-9999999999"
      }]);
    } finally { setSupportLoading(false); }
  };

  if (!user) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f1f5f9" }}>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header style={{ background: "#1e293b", padding: "0 16px", display: "flex", alignItems: "center", gap: 10, height: 54, flexShrink: 0 }}>

        {/* Back + Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => { if (mode === "table") router.push("/cashier/table"); else router.push("/cashier"); }}
            style={{ background: "none", border: "1px solid #334155", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: "#94a3b8" }}>
            ← Back
          </button>
          <div style={{ width: 1, height: 24, background: "#334155" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 28, height: 28, background: "#f97316", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🍽️</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#f1f5f9", lineHeight: 1.2 }}>
                {mode === "table" ? `Table ${tableLabel}` : mode === "takeaway" ? "Take Away" : mode === "delivery" ? "Delivery" : "Fast Billing"}
              </div>
              <div style={{ fontSize: 10, color: "#64748b" }}>{restaurantSettings.name}</div>
            </div>
          </div>
        </div>

        {/* Search Item */}
        <div style={{ position: "relative", flex: 2, minWidth: 0 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, pointerEvents: "none" }}>🔍</span>
          <input
            type="text" placeholder="Search Item"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "7px 10px 7px 32px", fontSize: 12, color: "#f1f5f9", outline: "none" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14 }}>✕</button>
          )}
        </div>

        {/* Bill No */}
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, pointerEvents: "none" }}>📋</span>
          <input
            type="text" placeholder="Bill No."
            value={billSearch}
            onChange={e => setBillSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleBillSearch()}
            style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "7px 10px 7px 32px", fontSize: 12, color: "#f1f5f9", outline: "none" }}
          />
        </div>

        {/* KOT No */}
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, pointerEvents: "none" }}>🧾</span>
          <input
            type="text" placeholder="KOT No."
            value={kotSearch}
            onChange={e => setKotSearch(e.target.value)}
            style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "7px 10px 7px 32px", fontSize: 12, color: "#f1f5f9", outline: "none" }}
          />
        </div>

        {/* New Order */}
        <button
          onClick={() => { clearOrder(); setSearchQuery(""); setBillSearch(""); setKotSearch(""); toast.success("New order started"); }}
          style={{ background: "#f97316", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, color: "#fff", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
          + New Order
        </button>

        {/* Items badge */}
        <div style={{ background: "#334155", color: "#f1f5f9", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
          {currentOrder.length} items
        </div>

        {/* Print Preview */}
        <button onClick={() => setShowReceipt(true)}
          style={{ background: "#334155", border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12, color: "#f1f5f9", whiteSpace: "nowrap", flexShrink: 0 }}>
          🖨️ Preview
        </button>

        {/* Request Support */}
        <button onClick={() => setShowSupport(true)}
          style={{ background: "#dc2626", border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12, color: "#fff", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
          🆘 Support
        </button>

      </header>

      {/* ── MOBILE TAB BAR ─────────────────────────────────── */}
      <div style={{ display: "flex", background: "#1e293b", borderBottom: "1px solid #334155" }} className="mobile-tabs">
        {["menu", "bill"].map(tab => (
          <button key={tab}
            onClick={() => setMobileTab(tab as "menu" | "bill")}
            style={{
              flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
              background: mobileTab === tab ? "#f97316" : "none",
              color: mobileTab === tab ? "#fff" : "#94a3b8",
              fontWeight: 700, fontSize: 13, textTransform: "capitalize"
            }}>
            {tab === "menu" ? "🍽️ Menu" : `🧾 Bill (${currentOrder.length})`}
          </button>
        ))}
      </div>

      {/* ── MAIN 3 PANELS ──────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* LEFT — Categories (hidden on mobile when bill tab active) */}
        <aside className={`categories-panel ${mobileTab === "bill" ? "hide-mobile" : ""}`}
          style={{ width: 155, background: "#fff", borderRight: "1px solid #e2e8f0", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "12px 12px 6px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>
            Categories
          </div>
          {categories.map(cat => (
            <button key={cat.id}
              onClick={() => { setActiveCategory(cat.id); setSearchQuery(""); }}
              style={{
                width: "100%", padding: "13px 14px", border: "none", cursor: "pointer",
                textAlign: "left", fontSize: 13, fontWeight: activeCategory === cat.id ? 700 : 500,
                background: activeCategory === cat.id ? "#fff7ed" : "none",
                color: activeCategory === cat.id ? "#ea580c" : "#374151",
                borderLeft: activeCategory === cat.id ? "3px solid #f97316" : "3px solid transparent",
                transition: "all .12s", lineHeight: 1.3,
              }}>
              {cat.name}
            </button>
          ))}
        </aside>

        {/* MIDDLE — Items grid (hidden on mobile when bill tab active) */}
        <section className={`items-panel ${mobileTab === "bill" ? "hide-mobile" : ""}`}
          style={{ flex: 1, overflowY: "auto", padding: 14, background: "#f8fafc" }}>
          {searchQuery && (
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, padding: "6px 10px", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              🔍 <strong>{displayedItems.length}</strong> results for "<strong>{searchQuery}</strong>"
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
            {displayedItems.map(item => {
              const qty = getQty(item.id);
              return (
                <div key={item.id}
                  style={{
                    background: qty > 0 ? "#fff7ed" : "#fff",
                    border: qty > 0 ? "2px solid #f97316" : "1px solid #e2e8f0",
                    borderRadius: 12, padding: 14, cursor: "pointer",
                    display: "flex", flexDirection: "column", gap: 6,
                    transition: "all .12s", position: "relative",
                    boxShadow: qty > 0 ? "0 2px 8px rgba(249,115,22,0.15)" : "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                  onClick={() => {
                    if (qty > 0) updateQty(item.id, qty + 1);
                    else addItem({ id: item.id, name: item.name, price: Number(item.price) });
                  }}>
                  {qty > 0 && (
                    <div style={{ position: "absolute", top: 8, right: 8, background: "#f97316", color: "#fff", borderRadius: 20, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                      {qty}
                    </div>
                  )}
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b", lineHeight: 1.3, paddingRight: qty > 0 ? 26 : 0 }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 17, color: "#ea580c", fontWeight: 800 }}>₹{item.price}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}
                    onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => { if (qty > 1) updateQty(item.id, qty - 1); else removeItem(item.id); }}
                      disabled={qty === 0}
                      style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e2e8f0", background: qty > 0 ? "#fee2e2" : "#f1f5f9", cursor: qty > 0 ? "pointer" : "not-allowed", fontSize: 18, fontWeight: 700, color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      −
                    </button>
                    <input
                      type="number" min={0} value={qty}
                      onChange={e => {
                        const v = parseInt(e.target.value) || 0;
                        if (v === 0) removeItem(item.id);
                        else if (qty > 0) updateQty(item.id, v);
                        else addItem({ id: item.id, name: item.name, price: Number(item.price) });
                      }}
                      style={{ width: 42, textAlign: "center", border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 0", fontSize: 13, fontWeight: 700, background: "#fff" }}
                    />
                    <button
                      onClick={() => { if (qty > 0) updateQty(item.id, qty + 1); else addItem({ id: item.id, name: item.name, price: Number(item.price) }); }}
                      style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "#f97316", cursor: "pointer", fontSize: 18, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      +
                    </button>
                  </div>
                </div>
              );
            })}
            {displayedItems.length === 0 && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", color: "#94a3b8", padding: "60px 0", fontSize: 14 }}>
                {searchQuery ? `No items found for "${searchQuery}"` : "No items in this category"}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT — Bill panel (hidden on mobile when menu tab active) */}
        <aside className={`bill-panel ${mobileTab === "menu" ? "hide-mobile" : ""}`}
          style={{ width: 340, background: "#fff", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", flexShrink: 0 }}>

          {/* Customer info */}
          <div style={{ padding: "12px 14px", background: "#fff7ed", borderBottom: "1px solid #fed7aa" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#ea580c", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Customer Info
            </div>
            <div style={{ position: "relative", marginBottom: 6 }}>
              <input
                type="text" placeholder="Customer name" value={customerName}
                onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true); searchCustomers(e.target.value); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                style={{ width: "100%", border: "1px solid #fed7aa", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", outline: "none" }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, zIndex: 100, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                  {suggestions.map((c, i) => (
                    <div key={i} onMouseDown={() => handleSelectCustomer(c)}
                      style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#fff7ed")}
                      onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                      <div style={{ fontWeight: 600 }}>{c.customer_name}</div>
                      <div style={{ color: "#94a3b8", fontSize: 11 }}>{c.customer_phone} · {c.order_count} orders</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <input
              type="tel" placeholder="Phone number (10 digits)" value={customerPhone} maxLength={10}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setCustomerPhone(val);
                if (val.length >= 2) { setShowSuggestions(true); searchCustomers(val); }
              }}
              style={{
                width: "100%", border: customerPhone.length > 0 && customerPhone.length < 10
                  ? "1px solid #ef4444" : "1px solid #fed7aa",
                borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", outline: "none", marginBottom: 6
              }}
            />
            {cashiers.length > 0 && (
              <select value={selectedCashier} onChange={e => setSelectedCashier(e.target.value)}
                style={{ width: "100%", border: "1px solid #fed7aa", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", outline: "none" }}>
                <option value="">Select cashier / steward</option>
                {cashiers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            )}
          </div>

          {/* Order items list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>
                Order Items
              </div>
              {currentOrder.length > 0 && (
                <button onClick={() => clearOrder()}
                  style={{ background: "none", border: "none", fontSize: 11, color: "#ef4444", cursor: "pointer" }}>
                  Clear all
                </button>
              )}
            </div>
            {currentOrder.length === 0 ? (
              <div style={{ textAlign: "center", color: "#cbd5e1", fontSize: 13, paddingTop: 30 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
                No items added yet
              </div>
            ) : (
              currentOrder.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>₹{item.price} × {item.quantity} = <span style={{ color: "#ea580c", fontWeight: 700 }}>₹{Math.round(item.price * item.quantity)}</span></div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button onClick={() => { if (item.quantity > 1) updateQty(item.id, item.quantity - 1); else removeItem(item.id); }}
                      style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #e2e8f0", background: "#fee2e2", cursor: "pointer", fontSize: 16, color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <span style={{ width: 22, textAlign: "center", fontSize: 13, fontWeight: 700 }}>{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, item.quantity + 1)}
                      style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: "#f97316", cursor: "pointer", fontSize: 16, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bill totals + controls */}
          <div style={{ padding: "12px 14px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer", color: "#374151", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={gstEnabled} onChange={e => setGstEnabled(e.target.checked)} />
                GST 5%
              </label>
              <input type="number" min={0} max={100} placeholder="% disc"
                value={discountPct || ""}
                onChange={e => setDiscountPct(Number(e.target.value))}
                style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 8px", fontSize: 12, textAlign: "center", outline: "none" }} />
              <input type="number" min={0} placeholder="₹ disc"
                value={discountFixed || ""}
                onChange={e => setDiscountFixed(Number(e.target.value))}
                style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 8px", fontSize: 12, textAlign: "center", outline: "none" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                <span>Subtotal</span><span>₹{bill.subtotal}</span>
              </div>
              {gstEnabled && <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                  <span>CGST (2.5%)</span><span>₹{bill.cgst}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                  <span>SGST (2.5%)</span><span>₹{bill.sgst}</span>
                </div>
              </>}
              {(discountPct > 0 || discountFixed > 0) && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#16a34a" }}>
                  <span>Discount</span>
                  <span>−₹{Math.round((bill.subtotal - bill.afterDiscount) * 100) / 100}</span>
                </div>
              )}
              {mode === "delivery" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Delivery ₹</span>
                  <input type="number" min={0} value={deliveryFee}
                    onChange={e => setDeliveryFee(Number(e.target.value))}
                    style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none" }} />
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 20, color: "#1e293b", paddingTop: 8, borderTop: "2px solid #1e293b", marginTop: 4 }}>
                <span>Total</span>
                <span style={{ color: "#f97316" }}>₹{bill.grandTotal}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                {saving ? "..." : "💾 Save"}
              </button>
              <button onClick={() => setShowReceipt(true)}
                style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, color: "#374151" }}>
                🖨️ Print
              </button>
            </div>
            <button onClick={handleSaveAndPrint} disabled={saving}
              style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, marginBottom: 6 }}>
              ✅ Save & Print
            </button>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={handleUndo}
                style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 12, color: "#374151" }}>
                ↩ Undo
              </button>
              <button onClick={handleCancel}
                style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: "#fee2e2", color: "#dc2626", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                ✕ Cancel
              </button>
            </div>
            <p style={{ fontSize: 10, color: "#cbd5e1", textAlign: "center", marginTop: 6 }}>
              Ctrl+S Save · Ctrl+P Print · Ctrl+Z Undo
            </p>
          </div>
        </aside>
      </div>

      {/* ── RECEIPT MODAL ──────────────────────────────────── */}
      {showReceipt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: 420, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>Receipt Preview</h3>
              <button onClick={() => setShowReceipt(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
            </div>
            <div id="receipt-content" style={{ fontFamily: "monospace", border: "1px dashed #ccc", borderRadius: 8, padding: 16, fontSize: 12 }}>
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{restaurantSettings.name}</div>
                {restaurantSettings.address && <div style={{ fontSize: 11, color: "#444", marginTop: 2, lineHeight: 1.5 }}>{restaurantSettings.address}</div>}
                {restaurantSettings.contact && <div style={{ fontSize: 11, marginTop: 2 }}>Contact: {restaurantSettings.contact}</div>}
                {restaurantSettings.gstin && <div style={{ fontSize: 11, marginTop: 2 }}>GSTIN: {restaurantSettings.gstin}</div>}
              </div>
              <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }} />
              {customerName && <div style={{ marginBottom: 4 }}>Name: {customerName}</div>}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span>Bill No: {orderNumber || "—"}</span>
                <span>Date: {new Date().toLocaleDateString('en-IN')}</span>
              </div>
              <div style={{ marginBottom: 2 }}>
                Table: {mode === "table" ? tableLabel : mode.toUpperCase()} | Time: {new Date().toLocaleTimeString('en-IN')}
              </div>
              {selectedCashier && <div style={{ marginBottom: 2 }}>Steward: {selectedCashier}</div>}
              <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }} />
              <div style={{ display: "grid", gridTemplateColumns: "0.4fr 2fr 0.6fr 0.7fr 0.8fr", fontWeight: 600, marginBottom: 6, fontSize: 11 }}>
                <span>Sl</span><span>Item</span>
                <span style={{ textAlign: "center" }}>Qty</span>
                <span style={{ textAlign: "right" }}>Rate</span>
                <span style={{ textAlign: "right" }}>Amt</span>
              </div>
              {currentOrder.map((item, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "0.4fr 2fr 0.6fr 0.7fr 0.8fr", marginBottom: 4, fontSize: 11 }}>
                  <span>{i + 1}</span>
                  <span style={{ wordBreak: "break-word" }}>{item.name}</span>
                  <span style={{ textAlign: "center" }}>{item.quantity}</span>
                  <span style={{ textAlign: "right" }}>{item.price}</span>
                  <span style={{ textAlign: "right" }}>{Math.round(item.price * item.quantity)}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Net All Total</span><span>{bill.subtotal}</span></div>
                {(discountPct > 0 || discountFixed > 0) && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a" }}>
                    <span>Discount {discountPct > 0 ? `(${discountPct}%)` : ""}</span>
                    <span>- {Math.round((bill.subtotal - bill.afterDiscount) * 100) / 100}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total</span><span>{bill.afterDiscount}</span></div>
                {serviceChargeAmt > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Service Charge @ {restaurantSettings.service_charge}%</span><span>{serviceChargeAmt}</span>
                  </div>
                )}
                {gstEnabled && <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>CGST @2.5%</span><span>{bill.cgst}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>SGST @2.5%</span><span>{bill.sgst}</span></div>
                </>}
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Round Off</span><span>{roundOff.toFixed(2)}</span></div>
                <div style={{ borderTop: "2px solid #000", marginTop: 4, paddingTop: 6 }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15 }}>
                  <span>Gross Amount</span><span>₹{bill.grandTotal}</span>
                </div>
              </div>
              <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }} />
              <div style={{ fontSize: 11, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>Amount: </span>{numberToWords(bill.grandTotal)} Rupees only
              </div>
              <div style={{ fontSize: 11, display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span>Total Items: {currentOrder.length}</span>
                {selectedCashier && <span>Steward: {selectedCashier}</span>}
              </div>
              <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }} />
              {restaurantSettings.upi_id && (
                <div style={{ textAlign: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 11, marginBottom: 4 }}>Scan to Pay via UPI app</div>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=upi://pay?pa=${restaurantSettings.upi_id}&pn=${encodeURIComponent(restaurantSettings.name)}&am=${bill.grandTotal}`}
                      alt="UPI QR" style={{ width: 120, height: 120 }}
                    />
                  </div>
                </div>
              )}
              <div style={{ textAlign: "center", fontSize: 11, color: "#888" }}>{restaurantSettings.footer_text}</div>
            </div>
            <div style={{ marginTop: 16 }}>
              <button onClick={() => window.print()}
                style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                🖨️ Print Receipt
              </button>
            </div>
            {customerPhone && customerPhone.length === 10 && (
              <div style={{ marginTop: 8 }}>
                <button onClick={handleShareBillLink}
                  style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "#25d366", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                  📱 Send Bill on WhatsApp
                </button>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => { setShowReceipt(false); clearOrder(); if (mode === "table") router.push("/cashier/table"); else router.push("/cashier"); }}
                style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                ✓ Done & New Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUPPORT MODAL ──────────────────────────────────── */}
      {showSupport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: 420, height: 560, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            {/* Header */}
            <div style={{ background: "#1e293b", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, background: "#f97316", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🆘</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>Request Support</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>AI assistant · Available 24/7</div>
                </div>
              </div>
              <button onClick={() => setShowSupport(false)}
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20 }}>✕</button>
            </div>

            {/* Chat */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {supportChat.length === 0 && (
                <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, paddingTop: 10 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🤖</div>
                  <div style={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}>BillEase Support</div>
                  <div style={{ marginBottom: 12 }}>Hi! How can I help you today?</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {["How do I add menu items?", "Bill is not printing", "How to apply discount?", "Reset table status", "How to add cashier?"].map(q => (
                      <button key={q} onClick={() => setSupportMsg(q)}
                        style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12, color: "#374151", textAlign: "left" }}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {supportChat.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "82%", padding: "10px 14px",
                    borderRadius: msg.role === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                    background: msg.role === "user" ? "#f97316" : "#f1f5f9",
                    color: msg.role === "user" ? "#fff" : "#1e293b",
                    fontSize: 13, lineHeight: 1.5
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {supportLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ background: "#f1f5f9", borderRadius: 14, padding: "10px 14px", fontSize: 13, color: "#94a3b8" }}>
                    Typing...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Contact bar */}
            <div style={{ padding: "8px 16px", background: "#fff7ed", borderTop: "1px solid #fed7aa", fontSize: 11, color: "#92400e", display: "flex", justifyContent: "space-between" }}>
              <span>📧 support@billease.in</span>
              <span>📞 +91-9999999999</span>
            </div>

            {/* Input */}
            <div style={{ padding: "10px 16px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8 }}>
              <input
                type="text" placeholder="Type your issue here..."
                value={supportMsg}
                onChange={e => setSupportMsg(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSupportSend()}
                style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none" }}
              />
              <button onClick={handleSupportSend} disabled={supportLoading || !supportMsg.trim()}
                style={{ background: "#f97316", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, opacity: supportLoading || !supportMsg.trim() ? 0.6 : 1 }}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}