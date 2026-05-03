"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Settings {
  name: string;
  address: string;
  contact: string;
  gstin: string;
  upi_id: string;
  service_charge: number;
  footer_text: string;
}

interface Cashier {
  id: string;
  name: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, init } = useAuthStore();

  const [settings, setSettings] = useState<Settings>({
    name: "", address: "", contact: "",
    gstin: "", upi_id: "", service_charge: 0,
    footer_text: "Thank you! Visit again",
  });

  const [cashiers,        setCashiers]        = useState<Cashier[]>([]);
  const [newCashier,      setNewCashier]      = useState("");
  const [saving,          setSaving]          = useState(false);
  const [activeTab,       setActiveTab]       = useState<"restaurant" | "cashiers">("restaurant");
  const [restaurantCode,  setRestaurantCode]  = useState("");

  useEffect(() => { init(); }, []);
  useEffect(() => {
    if (user && user.role !== "admin") {
      toast.error("Admin access only");
      router.push("/dashboard");
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
    fetchCashiers();
    fetchRestaurantCode();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get("/settings");
      const d = res.data;
      setSettings({
        name:           d.name           || "",
        address:        d.address        || "",
        contact:        d.contact        || "",
        gstin:          d.gstin          || "",
        upi_id:         d.upi_id         || "",
        service_charge: d.service_charge || 0,
        footer_text:    d.footer_text    || "Thank you! Visit again",
      });
    } catch { toast.error("Failed to load settings"); }
  };

  const fetchCashiers = async () => {
    try {
      const res = await api.get("/settings/cashiers");
      setCashiers(res.data);
    } catch { toast.error("Failed to load cashiers"); }
  };

  const fetchRestaurantCode = async () => {
    try {
      const res = await api.get("/restaurants/code");
      setRestaurantCode(res.data.code);
    } catch { console.error("Failed to load restaurant code"); }
  };

  const handleSaveSettings = async () => {
    if (!settings.name) return toast.error("Restaurant name is required");
    if (settings.contact && settings.contact.length !== 10)
      return toast.error("Contact must be 10 digits");
    if (settings.gstin && settings.gstin.length !== 15)
      return toast.error("GSTIN must be 15 characters");
    setSaving(true);
    try {
      await api.put("/settings", settings);
      toast.success("Settings saved successfully!");
    } catch { toast.error("Failed to save settings"); }
    finally { setSaving(false); }
  };

  const handleAddCashier = async () => {
    if (!newCashier.trim()) return toast.error("Enter cashier name");
    try {
      const res = await api.post("/settings/cashiers", { name: newCashier.trim() });
      setCashiers([...cashiers, res.data]);
      setNewCashier("");
      toast.success("Cashier added!");
    } catch { toast.error("Failed to add cashier"); }
  };

  const handleDeleteCashier = async (id: string) => {
    if (!window.confirm("Remove this cashier?")) return;
    try {
      await api.delete(`/settings/cashiers/${id}`);
      setCashiers(cashiers.filter(c => c.id !== id));
      toast.success("Cashier removed");
    } catch { toast.error("Failed to remove cashier"); }
  };

  if (!user) return null;

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px",
    border: "1.5px solid #e5e7eb", borderRadius: 10,
    fontSize: 14, color: "#111827", outline: "none",
    background: "#f9fafb", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12,
    fontWeight: 700, color: "#374151", marginBottom: 6,
  };

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
          <div style={{ fontWeight: 800, fontSize: 17, color: "#111827" }}>⚙️ Settings</div>
        </div>
        <button
          onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); router.push('/login'); }}
          style={{ width: 40, height: 40, borderRadius: "50%", background: "#fee2e2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </header>

      <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { id: "restaurant", label: "🏪 Restaurant" },
            { id: "cashiers",   label: "👤 Cashiers" },
          ].map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 12,
                fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer",
                background: activeTab === tab.id ? "#f97316" : "#fff",
                color: activeTab === tab.id ? "#fff" : "#374151",
                boxShadow: activeTab === tab.id ? "0 4px 12px rgba(249,115,22,0.3)" : "0 1px 4px rgba(0,0,0,0.06)",
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── RESTAURANT TAB ── */}
        {activeTab === "restaurant" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Restaurant Code */}
            {restaurantCode && (
              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 16, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#ea580c", marginBottom: 6 }}>
                  🔑 Your Restaurant Code
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#f97316", letterSpacing: 3, fontFamily: "monospace", marginBottom: 6 }}>
                  {restaurantCode}
                </div>
                <div style={{ fontSize: 12, color: "#92400e", marginBottom: 10 }}>
                  Share this code with your managers and cashiers
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(restaurantCode); toast.success("Code copied!"); }}
                  style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                  📋 Copy Code
                </button>
              </div>
            )}

            {/* Restaurant Name */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #f3f4f6", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 14 }}>
                Restaurant Information
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Restaurant Name <span style={{ color: "#ef4444" }}>*</span></label>
                <input type="text" value={settings.name}
                  onChange={e => setSettings({ ...settings, name: e.target.value })}
                  placeholder="e.g. Barkaas Arabic Restaurant"
                  style={inputStyle} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Address</label>
                <textarea value={settings.address}
                  onChange={e => setSettings({ ...settings, address: e.target.value })}
                  placeholder="Door No, Street, Area, City, State, PIN"
                  rows={3}
                  style={{ ...inputStyle, resize: "none" } as any} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Contact Number</label>
                  <input type="tel" maxLength={10} value={settings.contact}
                    onChange={e => setSettings({ ...settings, contact: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="10-digit number"
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>GSTIN</label>
                  <input type="text" maxLength={15} value={settings.gstin}
                    onChange={e => setSettings({ ...settings, gstin: e.target.value.toUpperCase().slice(0, 15) })}
                    placeholder="15-character GSTIN"
                    style={{ ...inputStyle, fontFamily: "monospace" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>UPI ID</label>
                  <input type="text" value={settings.upi_id}
                    onChange={e => setSettings({ ...settings, upi_id: e.target.value })}
                    placeholder="e.g. restaurant@ybl"
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Service Charge (%)</label>
                  <input type="number" min={0} max={20} value={settings.service_charge}
                    onChange={e => setSettings({ ...settings, service_charge: Number(e.target.value) })}
                    placeholder="e.g. 5"
                    style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Receipt Footer Text</label>
                <input type="text" value={settings.footer_text}
                  onChange={e => setSettings({ ...settings, footer_text: e.target.value })}
                  placeholder="e.g. Thank you! Visit again"
                  style={inputStyle} />
              </div>

              <button onClick={handleSaveSettings} disabled={saving}
                style={{ width: "100%", padding: "14px 0", background: saving ? "#fed7aa" : "#f97316", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", boxShadow: "0 4px 12px rgba(249,115,22,0.3)" }}>
                {saving ? "Saving..." : "💾 Save Settings"}
              </button>
            </div>
          </div>
        )}

        {/* ── CASHIERS TAB ── */}
        {activeTab === "cashiers" && (
          <div>
            {/* Add cashier */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 14, border: "1px solid #f3f4f6", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 12 }}>Add Cashier</div>
              <div style={{ display: "flex", gap: 10 }}>
                <input type="text" value={newCashier}
                  onChange={e => setNewCashier(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddCashier()}
                  placeholder="Enter cashier name"
                  style={{ ...inputStyle, flex: 1 }} />
                <button onClick={handleAddCashier}
                  style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", cursor: "pointer", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  + Add
                </button>
              </div>
            </div>

            {/* Cashiers list */}
            {cashiers.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>👤</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>No cashiers added yet</div>
                <div style={{ fontSize: 13 }}>Add cashier names above</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {cashiers.map(cashier => (
                  <div key={cashier.id}
                    style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, background: "#fff7ed", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#f97316", border: "2px solid #fed7aa" }}>
                        {cashier.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{cashier.name}</span>
                    </div>
                    <button onClick={() => handleDeleteCashier(cashier.id)}
                      style={{ background: "#fee2e2", border: "none", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontSize: 13, color: "#ef4444", fontWeight: 700 }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}