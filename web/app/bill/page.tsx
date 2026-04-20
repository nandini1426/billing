"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";

function BillContent() {
  const params = useSearchParams();
  const orderId = params.get("id");
  const [order, setOrder] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) { setError("Invalid bill link"); setLoading(false); return; }
    fetchBill();
  }, [orderId]);

  const fetchBill = async () => {
    try {
      const [orderRes, settingsRes] = await Promise.all([
        api.get(`/orders/${orderId}`),
        api.get("/settings"),
      ]);
      setOrder(orderRes.data);
      setSettings(settingsRes.data);
    } catch {
      setError("Bill not found");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading bill...</p>
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <p style={{ color: "#ef4444", fontSize: 14 }}>{error}</p>
    </div>
  );

  if (!order) return null;

  const subtotal    = Number(order.subtotal);
  const cgst        = Number(order.cgst);
  const sgst        = Number(order.sgst);
  const grandTotal  = Number(order.grand_total);
  const discountPct = Number(order.discount_pct);
  const serviceCharge = Number(settings?.service_charge || 0);
  const serviceChargeAmt = serviceCharge > 0
    ? Math.round((subtotal - (subtotal * discountPct / 100)) * serviceCharge / 100 * 100) / 100
    : 0;
  const roundOff = grandTotal - (subtotal - (subtotal * discountPct / 100) + cgst + sgst + serviceChargeAmt);

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

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "20px 16px" }}>
      <div style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>

        {/* Restaurant header */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 20, color: "#111827" }}>
            {settings?.name || "Restaurant"}
          </div>
          {settings?.address && (
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 1.5 }}>
              {settings.address}
            </div>
          )}
          {settings?.contact && (
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
              📞 {settings.contact}
            </div>
          )}
          {settings?.gstin && (
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
              GSTIN: {settings.gstin}
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px dashed #d1d5db", margin: "12px 0" }} />

        {/* Bill info */}
        <div style={{ fontSize: 13, color: "#374151", marginBottom: 12 }}>
          {order.customer_name && (
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: "#9ca3af" }}>Customer: </span>
              <span style={{ fontWeight: 600 }}>{order.customer_name}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span><span style={{ color: "#9ca3af" }}>Bill No: </span><span style={{ fontWeight: 600 }}>#{order.order_number}</span></span>
            <span style={{ color: "#9ca3af" }}>{new Date(order.created_at).toLocaleDateString('en-IN')}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span><span style={{ color: "#9ca3af" }}>Type: </span><span style={{ textTransform: "capitalize" }}>{order.order_type}</span></span>
            <span style={{ color: "#9ca3af" }}>{new Date(order.created_at).toLocaleTimeString('en-IN')}</span>
          </div>
        </div>

        <div style={{ borderTop: "1px dashed #d1d5db", margin: "12px 0" }} />

        {/* Items */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "0.3fr 2fr 0.5fr 0.7fr 0.8fr", fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 8 }}>
            <span>Sl</span>
            <span>Item</span>
            <span style={{ textAlign: "center" }}>Qty</span>
            <span style={{ textAlign: "right" }}>Rate</span>
            <span style={{ textAlign: "right" }}>Amt</span>
          </div>
          {order.items?.filter((i: any) => i !== null).map((item: any, idx: number) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "0.3fr 2fr 0.5fr 0.7fr 0.8fr", fontSize: 13, paddingBottom: 8, borderBottom: "1px solid #f9fafb" }}>
              <span style={{ color: "#9ca3af" }}>{idx + 1}</span>
              <span style={{ color: "#111827" }}>{item.name}</span>
              <span style={{ textAlign: "center", color: "#374151" }}>{item.quantity}</span>
              <span style={{ textAlign: "right", color: "#374151" }}>₹{item.unit_price}</span>
              <span style={{ textAlign: "right", fontWeight: 600, color: "#111827" }}>₹{item.line_total}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px dashed #d1d5db", margin: "12px 0" }} />

        {/* Totals */}
        <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280" }}>
            <span>Net All Total</span><span>₹{subtotal}</span>
          </div>
          {discountPct > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a" }}>
              <span>Discount ({discountPct}%)</span>
              <span>- ₹{Math.round(subtotal * discountPct / 100 * 100) / 100}</span>
            </div>
          )}
          {Number(order.discount_fixed) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a" }}>
              <span>Discount (Fixed)</span>
              <span>- ₹{order.discount_fixed}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280" }}>
            <span>Total</span>
            <span>₹{Math.round((subtotal - (subtotal * discountPct / 100)) * 100) / 100}</span>
          </div>
          {serviceChargeAmt > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280" }}>
              <span>Service Charge ({serviceCharge}%)</span>
              <span>₹{serviceChargeAmt}</span>
            </div>
          )}
          {cgst > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280" }}>
              <span>CGST @2.5%</span><span>₹{cgst}</span>
            </div>
          )}
          {sgst > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280" }}>
              <span>SGST @2.5%</span><span>₹{sgst}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280" }}>
            <span>Round Off</span><span>₹{roundOff.toFixed(2)}</span>
          </div>

          <div style={{ borderTop: "2px solid #111827", paddingTop: 8, marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 18, color: "#111827" }}>
              <span>Gross Amount</span><span>₹{grandTotal}</span>
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px dashed #d1d5db", margin: "12px 0" }} />

        {/* Amount in words */}
        <div style={{ fontSize: 12, color: "#374151", marginBottom: 8 }}>
          <span style={{ fontWeight: 600 }}>Amount: </span>
          {numberToWords(grandTotal)} Rupees only
        </div>

        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
          Total Items: {order.items?.filter((i: any) => i !== null).length || 0}
        </div>

        <div style={{ borderTop: "1px dashed #d1d5db", margin: "12px 0" }} />

        {/* UPI QR */}
        {settings?.upi_id && (
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
              Scan to Pay via UPI app
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=${settings.upi_id}&pn=${encodeURIComponent(settings.name)}&am=${grandTotal}`}
                alt="UPI QR"
                style={{ width: 150, height: 150 }}
              />
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              {settings.upi_id}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
          {settings?.footer_text || "Thank you! Visit again"}
        </div>

        {/* Print button */}
        <button
          onClick={() => window.print()}
          style={{ width: "100%", marginTop: 16, padding: "12px 0", background: "#f97316", color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}
        >
          🖨️ Print This Bill
        </button>

      </div>
    </div>
  );
}

export default function BillPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", padding: 40 }}>Loading...</div>}>
      <BillContent />
    </Suspense>
  );
}