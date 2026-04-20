"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useAuthStore from "@/store/authStore";
import useOrderStore from "@/store/orderStore";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { useCustomer, Customer } from "@/lib/useCustomer";

// ── Number to words ───────────────────────────────────────────
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

  const { user, init } = useAuthStore();
  const {
    currentOrder, addItem, addItemWithQty,
    removeItem, updateQty, clearOrder, calcBill
  } = useOrderStore();

  const { suggestions, searchCustomers, clearSuggestions } = useCustomer();

  const [categories,      setCategories]      = useState<Category[]>([]);
  const [menuItems,       setMenuItems]       = useState<MenuItem[]>([]);
  const [activeCategory,  setActiveCategory]  = useState<string | null>(null);
  const [gstEnabled,      setGstEnabled]      = useState(true);
  const [discountPct,     setDiscountPct]     = useState(0);
  const [discountFixed,   setDiscountFixed]   = useState(0);
  const [deliveryFee,     setDeliveryFee]     = useState(mode === "delivery" ? 40 : 0);
  const [saving,          setSaving]          = useState(false);
  const [savedId,         setSavedId]         = useState<string | null>(params.get("orderId") || null);
  const [orderNumber,     setOrderNumber]     = useState<string>("");
  const [showReceipt,     setShowReceipt]     = useState(false);
  const [customerName,    setCustomerName]    = useState("");
  const [customerPhone,   setCustomerPhone]   = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState("");
  const [cashiers,        setCashiers]        = useState<Cashier[]>([]);
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
    ? Math.round(bill.afterDiscount * restaurantSettings.service_charge / 100 * 100) / 100
    : 0;

  const roundOff = bill.grandTotal - (bill.afterDiscount + serviceChargeAmt + bill.cgst + bill.sgst);

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

  // ── WhatsApp Bill Link ────────────────────────────────────
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
      `\n*Items Ordered:*\n` +
      `${itemsList}\n` +
      `\n💰 *Bill Summary*\n` +
      `Subtotal: ₹${bill.subtotal}\n` +
      (discountPct > 0 || discountFixed > 0
        ? `Discount: -₹${Math.round((bill.subtotal - bill.afterDiscount) * 100) / 100}\n`
        : "") +
      (gstEnabled ? `CGST (2.5%): ₹${bill.cgst}\nSGST (2.5%): ₹${bill.sgst}\n` : "") +
      (serviceChargeAmt > 0 ? `Service Charge: ₹${serviceChargeAmt}\n` : "") +
      `\n*💵 Gross Amount: ₹${bill.grandTotal}*\n` +
      `_(${numberToWords(bill.grandTotal)} Rupees only)_\n` +
      `\n🔗 View your bill here:\n${billUrl}\n\n` +
      `_${restaurantSettings.footer_text || "Thank you! Visit again"}_`;

    window.open(
      `https://wa.me/91${customerPhone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
    toast.success("WhatsApp opened with bill link!");
  };

  if (!user) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f8f9fa" }}>

      {/* TOP BAR */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => {
              if (mode === "table") router.push("/cashier/table");
              else router.push("/cashier");
            }}
            style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, color: "#6b7280" }}>
            ← Back
          </button>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>
            {mode === "table" ? `Table ${tableLabel}`
              : mode === "takeaway" ? "Take Away"
              : mode === "delivery" ? "Delivery"
              : "Fast Billing"}
          </span>
          <span style={{ background: "#f3f4f6", padding: "3px 10px", borderRadius: 20, fontSize: 12, color: "#6b7280" }}>
            {currentOrder.length} items
          </span>
        </div>
        <button onClick={() => setShowReceipt(true)}
          style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13 }}>
          🖨️ Print Preview
        </button>
      </header>

      {/* 3 PANELS */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* LEFT — Categories */}
        <aside style={{ width: 160, background: "#fff", borderRight: "1px solid #e5e7eb", overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Categories
          </p>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: "10px 12px", borderRadius: 10, border: "1px solid transparent",
                cursor: "pointer", textAlign: "left", fontSize: 13, fontWeight: 500,
                background:  activeCategory === cat.id ? "#fff7ed" : "none",
                borderColor: activeCategory === cat.id ? "#fed7aa" : "transparent",
                color:       activeCategory === cat.id ? "#ea580c" : "#374151"
              }}>
              {cat.name}
            </button>
          ))}
        </aside>

        {/* MIDDLE — Items */}
        <section style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Items
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {menuItems.map(item => {
              const qty = getQty(item.id);
              return (
                <div key={item.id}
                  style={{ background: "#fff", border: qty > 0 ? "2px solid #f97316" : "1px solid #e5e7eb", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{item.name}</div>
                  <div style={{ fontSize: 15, color: "#ea580c", fontWeight: 700 }}>₹{item.price}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      onClick={() => { if (qty > 1) updateQty(item.id, qty - 1); else removeItem(item.id); }}
                      disabled={qty === 0}
                      style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e5e7eb", background: qty > 0 ? "#fee2e2" : "#f9fafb", cursor: qty > 0 ? "pointer" : "not-allowed", fontSize: 18, fontWeight: 700, color: "#ef4444" }}>
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
                      style={{ width: 44, textAlign: "center", border: "1px solid #e5e7eb", borderRadius: 8, padding: "4px 0", fontSize: 14, fontWeight: 600 }}
                    />
                    <button
                      onClick={() => { if (qty > 0) updateQty(item.id, qty + 1); else addItem({ id: item.id, name: item.name, price: Number(item.price) }); }}
                      style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "#f97316", cursor: "pointer", fontSize: 18, fontWeight: 700, color: "#fff" }}>
                      +
                    </button>
                  </div>
                </div>
              );
            })}
            {menuItems.length === 0 && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>
                No items in this category
              </div>
            )}
          </div>
        </section>

        {/* RIGHT — Bill */}
        <aside style={{ width: 320, background: "#fff", borderLeft: "1px solid #e5e7eb", overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>

          {/* Customer Info */}
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#ea580c", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Customer Info
            </p>
            <div style={{ position: "relative", marginBottom: 8 }}>
              <input
                type="text" placeholder="Customer name" value={customerName}
                onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true); searchCustomers(e.target.value); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 10px", fontSize: 13 }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, zIndex: 100, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                  {suggestions.map((c, i) => (
                    <div key={i} onMouseDown={() => handleSelectCustomer(c)}
                      style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f3f4f6", fontSize: 13 }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#fff7ed")}
                      onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                      <div style={{ fontWeight: 600 }}>{c.customer_name}</div>
                      <div style={{ color: "#6b7280", fontSize: 12 }}>{c.customer_phone} · {c.order_count} orders</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <input
              type="tel" placeholder="10-digit phone number" value={customerPhone} maxLength={10}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setCustomerPhone(val);
                if (val.length >= 2) { setShowSuggestions(true); searchCustomers(val); }
              }}
              style={{
                width: "100%", borderRadius: 8, padding: "7px 10px", fontSize: 13, marginBottom: 8,
                border: customerPhone.length > 0 && customerPhone.length < 10 ? "1px solid #ef4444" : "1px solid #e5e7eb"
              }}
            />
            {customerPhone.length > 0 && customerPhone.length < 10 && (
              <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 8 }}>Phone must be 10 digits</p>
            )}
            {cashiers.length > 0 && (
              <select value={selectedCashier} onChange={e => setSelectedCashier(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 10px", fontSize: 13, background: "#fff" }}>
                <option value="">Select cashier / steward</option>
                {cashiers.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Bill Summary */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>
            Bill Summary
          </p>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", background: "#f9fafb", padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>
              <span>Item</span><span style={{ textAlign: "right" }}>Rate</span>
              <span style={{ textAlign: "center" }}>Qty</span><span style={{ textAlign: "right" }}>Total</span>
            </div>
            {currentOrder.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#d1d5db", fontSize: 13 }}>No items yet</div>
            ) : (
              currentOrder.map(item => (
                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "8px 12px", fontSize: 13, borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                  <span style={{ textAlign: "right", color: "#6b7280" }}>₹{item.price}</span>
                  <span style={{ textAlign: "center" }}>{item.quantity}</span>
                  <span style={{ textAlign: "right", fontWeight: 600 }}>₹{Math.round(item.price * item.quantity * 100) / 100}</span>
                </div>
              ))
            )}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={gstEnabled} onChange={e => setGstEnabled(e.target.checked)} />
            Add GST (CGST 2.5% + SGST 2.5%)
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#6b7280", minWidth: 70 }}>Discount</span>
            <input type="number" min={0} max={100} placeholder="% off" value={discountPct || ""}
              onChange={e => setDiscountPct(Number(e.target.value))}
              style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", fontSize: 13, textAlign: "right" }} />
            <input type="number" min={0} placeholder="₹ off" value={discountFixed || ""}
              onChange={e => setDiscountFixed(Number(e.target.value))}
              style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", fontSize: 13, textAlign: "right" }} />
          </div>

          {mode === "delivery" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#6b7280", minWidth: 70 }}>Delivery</span>
              <input type="number" min={0} value={deliveryFee}
                onChange={e => setDeliveryFee(Number(e.target.value))}
                style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", fontSize: 13, textAlign: "right" }} />
            </div>
          )}

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280" }}>
              <span>Subtotal</span><span>₹{bill.subtotal}</span>
            </div>
            {gstEnabled && <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280" }}>
                <span>CGST (2.5%)</span><span>₹{bill.cgst}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280" }}>
                <span>SGST (2.5%)</span><span>₹{bill.sgst}</span>
              </div>
            </>}
            {(discountPct > 0 || discountFixed > 0) && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#16a34a" }}>
                <span>Discount</span>
                <span>−₹{Math.round((bill.subtotal - bill.afterDiscount) * 100) / 100}</span>
              </div>
            )}
            {mode === "delivery" && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280" }}>
                <span>Delivery Fee</span><span>₹{deliveryFee}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 20, color: "#111827", marginTop: 6, paddingTop: 8, borderTop: "2px solid #111827" }}>
              <span>Total</span><span>₹{bill.grandTotal}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
              {saving ? "Saving…" : "💾 Save"}
            </button>
            <button onClick={() => setShowReceipt(true)}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
              🖨️ Print
            </button>
          </div>
          <button onClick={handleSaveAndPrint} disabled={saving}
            style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "#16a34a", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
            ✅ Save & Print
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleUndo}
              style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", fontSize: 13 }}>
              ↩ Undo
            </button>
            <button onClick={handleCancel}
              style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", background: "#fee2e2", color: "#dc2626", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
              ✕ Cancel
            </button>
          </div>
          <p style={{ fontSize: 10, color: "#d1d5db", textAlign: "center" }}>
            Ctrl+S Save · Ctrl+P Print · Ctrl+Z Undo · Esc Cancel
          </p>
        </aside>
      </div>

      {/* RECEIPT MODAL */}
      {showReceipt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: 420, maxHeight: "90vh", overflowY: "auto" }}>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>Receipt Preview</h3>
              <button onClick={() => setShowReceipt(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
            </div>

            {/* Receipt content */}
            <div id="receipt-content" style={{ fontFamily: "monospace", border: "1px dashed #ccc", borderRadius: 8, padding: 16, fontSize: 12 }}>
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{restaurantSettings.name}</div>
                {restaurantSettings.address && (
                  <div style={{ fontSize: 11, color: "#444", marginTop: 2, lineHeight: 1.5 }}>{restaurantSettings.address}</div>
                )}
                {restaurantSettings.contact && (
                  <div style={{ fontSize: 11, marginTop: 2 }}>Contact: {restaurantSettings.contact}</div>
                )}
                {restaurantSettings.gstin && (
                  <div style={{ fontSize: 11, marginTop: 2 }}>GSTIN: {restaurantSettings.gstin}</div>
                )}
              </div>

              <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }} />

              {customerName && <div style={{ marginBottom: 4 }}>Name: {customerName}</div>}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span>Bill No: {orderNumber || "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span>Table: {mode === "table" ? tableLabel : mode.toUpperCase()}</span>
                <span>Date: {new Date().toLocaleDateString('en-IN')}</span>
              </div>
              <div style={{ marginBottom: 2 }}>Print Time: {new Date().toLocaleString('en-IN')}</div>
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
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Net All Total</span><span>{bill.subtotal}</span>
                </div>
                {(discountPct > 0 || discountFixed > 0) && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a" }}>
                    <span>Discount {discountPct > 0 ? `(${discountPct}%)` : ""}</span>
                    <span>- {Math.round((bill.subtotal - bill.afterDiscount) * 100) / 100}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Total</span><span>{bill.afterDiscount}</span>
                </div>
                {serviceChargeAmt > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Service Charge @ {restaurantSettings.service_charge}%</span>
                    <span>{serviceChargeAmt}</span>
                  </div>
                )}
                {gstEnabled && <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>CGST @2.5%</span><span>{bill.cgst}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>SGST @2.5%</span><span>{bill.sgst}</span>
                  </div>
                </>}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Round Off</span><span>{roundOff.toFixed(2)}</span>
                </div>
                <div style={{ borderTop: "2px solid #000", marginTop: 4, paddingTop: 6 }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15 }}>
                  <span>Gross Amount</span><span>₹{bill.grandTotal}</span>
                </div>
              </div>

              <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }} />

              <div style={{ fontSize: 11, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>Amount: </span>
                {numberToWords(bill.grandTotal)} Rupees only
              </div>
              <div style={{ fontSize: 11, marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
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
                      alt="UPI QR"
                      style={{ width: 120, height: 120 }}
                    />
                  </div>
                </div>
              )}

              <div style={{ textAlign: "center", fontSize: 11, color: "#888" }}>
                {restaurantSettings.footer_text}
              </div>
            </div>

            {/* Buttons */}
            <div style={{ marginTop: 16 }}>
              <button onClick={() => window.print()}
                style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                🖨️ Print Receipt
              </button>
            </div>

            {/* WhatsApp Bill Link */}
            {customerPhone && customerPhone.length === 10 && (
              <div style={{ marginTop: 8 }}>
                <button onClick={handleShareBillLink}
                  style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "#25d366", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                  📱 Send Bill on WhatsApp
                </button>
              </div>
            )}

            {/* Done button */}
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => {
                  setShowReceipt(false);
                  clearOrder();
                  if (mode === "table") router.push("/cashier/table");
                  else router.push("/cashier");
                }}
                style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                ✓ Done & New Order
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}