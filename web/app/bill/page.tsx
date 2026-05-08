"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function BillContent() {
  const params  = useSearchParams();
  const orderId = params.get("id");
  const [order,    setOrder]    = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  useEffect(() => {
    if (!orderId) { setError("Invalid bill link"); setLoading(false); return; }
    fetchBill();
  }, [orderId]);

  const fetchBill = async () => {
    try {
      const [orderRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/orders/public/${orderId}`),
        fetch(`${API_URL}/orders/public/${orderId}/settings`),
      ]);
      if (!orderRes.ok) { setError("Bill not found"); setLoading(false); return; }
      const orderData    = await orderRes.json();
      const settingsData = await settingsRes.json();
      setOrder(orderData);
      setSettings(settingsData);
    } catch {
      setError("Failed to load bill");
    } finally { setLoading(false); }
  };

  const numberToWords = (num: number): string => {
    const ones = ["","One","Two","Three","Four","Five","Six","Seven",
      "Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen",
      "Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
    const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
    if (num === 0) return "Zero";
    function convert(n: number): string {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " "+ones[n%10] : "");
      if (n < 1000) return ones[Math.floor(n/100)] + " Hundred" + (n%100 ? " "+convert(n%100) : "");
      if (n < 100000) return convert(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " "+convert(n%1000) : "");
      return convert(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " "+convert(n%100000) : "");
    }
    return convert(Math.floor(num));
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div style={{ textAlign: "center", color: "#94a3b8" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🧾</div>
        <div>Loading your bill...</div>
      </div>
    </div>
  );

  if (error || !order) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
        <div style={{ color: "#ef4444", fontSize: 16, fontWeight: 700 }}>{error || "Bill not found"}</div>
        <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>The bill link may have expired or is invalid</div>
      </div>
    </div>
  );

  const subtotal    = Number(order.subtotal);
  const cgst        = Number(order.cgst);
  const sgst        = Number(order.sgst);
  const grandTotal  = Number(order.grand_total);
  const discountPct = Number(order.discount_pct);
  const discountFixed = Number(order.discount_fixed);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", padding: "20px 16px", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>

        {/* Header card */}
        <div style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", borderRadius: "20px 20px 0 0", padding: "28px 24px", textAlign: "center", color: "#fff" }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🍽️</div>
          <div style={{ fontWeight: 900, fontSize: 24, letterSpacing: "-0.5px" }}>
            {settings?.name || "Restaurant"}
          </div>
          {settings?.address && (
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4, lineHeight: 1.5 }}>
              {settings.address}
            </div>
          )}
          {settings?.contact && (
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              📞 {settings.contact}
            </div>
          )}
          {settings?.gstin && (
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2, fontFamily: "monospace" }}>
              GSTIN: {settings.gstin}
            </div>
          )}
        </div>

        {/* Bill info */}
        <div style={{ background: "#fff", padding: "20px 24px", borderLeft: "1px solid #f3f4f6", borderRight: "1px solid #f3f4f6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Bill Number</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#f97316" }}>#{order.order_number}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Date</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{new Date(order.created_at).toLocaleDateString('en-IN')}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{new Date(order.created_at).toLocaleTimeString('en-IN')}</div>
            </div>
          </div>

          {order.customer_name && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#ea580c", fontWeight: 700, marginBottom: 2 }}>CUSTOMER</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{order.customer_name}</div>
              {order.customer_phone && <div style={{ fontSize: 12, color: "#94a3b8" }}>📞 {order.customer_phone}</div>}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, background: "#f8fafc", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Type</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", textTransform: "capitalize", marginTop: 2 }}>{order.order_type}</div>
            </div>
            <div style={{ flex: 1, background: "#f8fafc", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Status</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: order.status === "completed" ? "#16a34a" : "#f97316", textTransform: "capitalize", marginTop: 2 }}>{order.status}</div>
            </div>
          </div>
        </div>

        {/* Items */}
        <div style={{ background: "#fff", padding: "0 24px", borderLeft: "1px solid #f3f4f6", borderRight: "1px solid #f3f4f6" }}>
          <div style={{ borderTop: "1px dashed #e5e7eb", paddingTop: 16, paddingBottom: 4 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 0.5fr 0.7fr 0.8fr", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #f3f4f6" }}>
              <span>Item</span>
              <span style={{ textAlign: "center" }}>Qty</span>
              <span style={{ textAlign: "right" }}>Rate</span>
              <span style={{ textAlign: "right" }}>Amt</span>
            </div>
            {order.items?.filter((i: any) => i !== null).map((item: any, idx: number) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 0.5fr 0.7fr 0.8fr", fontSize: 13, paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #f9fafb" }}>
                <span style={{ fontWeight: 600, color: "#111827" }}>{item.name}</span>
                <span style={{ textAlign: "center", color: "#374151" }}>{item.quantity}</span>
                <span style={{ textAlign: "right", color: "#374151" }}>₹{item.unit_price}</span>
                <span style={{ textAlign: "right", fontWeight: 700, color: "#111827" }}>₹{item.line_total}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div style={{ background: "#fff", padding: "16px 24px", borderLeft: "1px solid #f3f4f6", borderRight: "1px solid #f3f4f6" }}>
          <div style={{ borderTop: "1px dashed #e5e7eb", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#64748b" }}>
              <span>Subtotal</span><span>₹{subtotal}</span>
            </div>
            {discountPct > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#16a34a" }}>
                <span>Discount ({discountPct}%)</span>
                <span>-₹{Math.round(subtotal * discountPct / 100 * 100) / 100}</span>
              </div>
            )}
            {discountFixed > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#16a34a" }}>
                <span>Discount</span><span>-₹{discountFixed}</span>
              </div>
            )}
            {cgst > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#64748b" }}>
                <span>CGST @2.5%</span><span>₹{cgst}</span>
              </div>
            )}
            {sgst > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#64748b" }}>
                <span>SGST @2.5%</span><span>₹{sgst}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 20, color: "#111827", paddingTop: 12, borderTop: "2px solid #f97316", marginTop: 4 }}>
              <span>Total Amount</span>
              <span style={{ color: "#f97316" }}>₹{grandTotal}</span>
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", textAlign: "right" }}>
              {numberToWords(grandTotal)} Rupees only
            </div>
          </div>
        </div>

        {/* UPI QR */}
        {settings?.upi_id && (
          <div style={{ background: "#fff", padding: "16px 24px", borderLeft: "1px solid #f3f4f6", borderRight: "1px solid #f3f4f6", textAlign: "center" }}>
            <div style={{ borderTop: "1px dashed #e5e7eb", paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>📱 Scan to Pay via UPI</div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=${settings.upi_id}&pn=${encodeURIComponent(settings.name || "")}&am=${grandTotal}`}
                  alt="UPI QR" style={{ width: 150, height: 150, borderRadius: 8 }}
                />
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{settings.upi_id}</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", borderRadius: "0 0 20px 20px", padding: "20px 24px", textAlign: "center", color: "#fff" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
            {settings?.footer_text || "Thank you! Visit again 😊"}
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>
            This is a digital bill — no paper needed 🌱
          </div>
        </div>

        {/* Print button */}
        <button onClick={() => window.print()}
          style={{ width: "100%", marginTop: 16, padding: "14px 0", background: "#1e293b", color: "#fff", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          🖨️ Print This Bill
        </button>

      </div>
    </div>
  );
}

export default function BillPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#94a3b8" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🧾</div>
          Loading...
        </div>
      </div>
    }>
      <BillContent />
    </Suspense>
  );
}