"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const router = useRouter();

  const [accountType,        setAccountType]        = useState<"owner" | "staff" | null>(null);
  const [loading,            setLoading]            = useState(false);
  const [restaurantName,     setRestaurantName]     = useState("");
  const [restaurantCode,     setRestaurantCode]     = useState("");
  const [codeValid,          setCodeValid]          = useState<boolean | null>(null);
  const [codeRestaurantName, setCodeRestaurantName] = useState("");
  const [role,               setRole]               = useState<"manager" | "cashier">("cashier");

  const [form, setForm] = useState({
    username: "", email: "", password: "",
    confirmPassword: "", phone: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCodeChange = async (code: string) => {
    setRestaurantCode(code.toUpperCase());
    setCodeValid(null);
    setCodeRestaurantName("");
    if (code.length < 11) return;
    try {
      const res = await api.post('/restaurants/validate-code', { code: code.toUpperCase() });
      if (res.data.valid) {
        setCodeValid(true);
        setCodeRestaurantName(res.data.restaurant.name);
      }
    } catch { setCodeValid(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountType) return toast.error("Select account type first");
    if (!form.username || form.username.length < 3) return toast.error("Username must be at least 3 characters");
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error("Invalid email");
    if (!form.password || form.password.length < 4) return toast.error("Password must be at least 4 characters");
    if (form.password !== form.confirmPassword) return toast.error("Passwords do not match");
    if (!form.phone) return toast.error("Phone number required");
    if (accountType === "owner" && !restaurantName.trim()) return toast.error("Restaurant name is required");
    if (accountType === "staff" && !codeValid) return toast.error("Enter a valid restaurant code");

    setLoading(true);
    try {
      await api.post('/auth/register', {
        username:        form.username,
        email:           form.email,
        password:        form.password,
        phone:           form.phone,
        role:            accountType === "owner" ? "admin" : role,
        restaurant_name: accountType === "owner" ? restaurantName : undefined,
        restaurant_code: accountType === "staff" ? restaurantCode : undefined,
      });
      toast.success(accountType === "owner"
        ? "Restaurant created! Please sign in."
        : "Account created! Please sign in."
      );
      router.push("/login");
    } catch (err: any) {
      toast.error(err.error || "Registration failed");
    } finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px",
    border: "1.5px solid #e5e7eb", borderRadius: 12,
    fontSize: 15, color: "#111827", outline: "none",
    background: "#f9fafb", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 13,
    fontWeight: 600, color: "#374151", marginBottom: 6,
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)",
      padding: "20px 16px",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 72, height: 72, background: "#f97316",
            borderRadius: 20, display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 14px",
            boxShadow: "0 8px 24px rgba(249,115,22,0.3)", fontSize: 36,
          }}>🍽️</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: 0 }}>BillEase</h1>
          <p style={{ color: "#9ca3af", fontSize: 14, marginTop: 4 }}>Create your account</p>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #f3f4f6" }}>

          {/* Account type selector */}
          {!accountType && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 6 }}>Who are you?</h2>
              <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>Select your account type</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button onClick={() => setAccountType("owner")}
                  style={{ background: "#fff", border: "2px solid #fed7aa", borderRadius: 16, padding: "18px 20px", cursor: "pointer", textAlign: "left", transition: "all .15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 52, height: 52, background: "#fff7ed", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>🏪</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: "#111827", marginBottom: 3 }}>Restaurant Owner</div>
                      <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.4 }}>Create a new restaurant. Get a unique code to share with staff.</div>
                    </div>
                  </div>
                </button>

                <button onClick={() => setAccountType("staff")}
                  style={{ background: "#fff", border: "2px solid #bfdbfe", borderRadius: 16, padding: "18px 20px", cursor: "pointer", textAlign: "left", transition: "all .15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 52, height: 52, background: "#eff6ff", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>👤</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: "#111827", marginBottom: 3 }}>Staff Member</div>
                      <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.4 }}>Join an existing restaurant using the code from your owner.</div>
                    </div>
                  </div>
                </button>
              </div>

              <p style={{ textAlign: "center", fontSize: 13, color: "#9ca3af", marginTop: 20 }}>
                Already have an account?{" "}
                <Link href="/login" style={{ color: "#f97316", fontWeight: 700, textDecoration: "none" }}>Sign in</Link>
              </p>
            </div>
          )}

          {/* Registration form */}
          {accountType && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <button onClick={() => setAccountType(null)}
                  style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 14, color: "#374151", fontWeight: 700 }}>
                  ←
                </button>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#111827" }}>
                    {accountType === "owner" ? "🏪 Restaurant Owner" : "👤 Staff Member"}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>
                    {accountType === "owner" ? "Creates a new restaurant" : "Joins an existing restaurant"}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Owner — restaurant name */}
                {accountType === "owner" && (
                  <div>
                    <label style={labelStyle}>Restaurant Name <span style={{ color: "#ef4444" }}>*</span></label>
                    <input type="text" value={restaurantName}
                      onChange={e => setRestaurantName(e.target.value)}
                      placeholder="e.g. Barkaas Arabic Restaurant"
                      style={inputStyle} />
                  </div>
                )}

                {/* Staff — restaurant code */}
                {accountType === "staff" && (
                  <div>
                    <label style={labelStyle}>Restaurant Code <span style={{ color: "#ef4444" }}>*</span></label>
                    <input type="text" value={restaurantCode}
                      onChange={e => handleCodeChange(e.target.value)}
                      placeholder="e.g. REST-ABC123"
                      maxLength={11}
                      style={{
                        ...inputStyle,
                        fontFamily: "monospace",
                        textTransform: "uppercase",
                        borderColor: codeValid === true ? "#86efac" : codeValid === false ? "#fca5a5" : "#e5e7eb",
                        background: codeValid === true ? "#f0fdf4" : codeValid === false ? "#fef2f2" : "#f9fafb",
                      }} />
                    {codeValid === true && (
                      <p style={{ fontSize: 12, color: "#16a34a", marginTop: 4, fontWeight: 600 }}>✅ {codeRestaurantName}</p>
                    )}
                    {codeValid === false && (
                      <p style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>❌ Invalid restaurant code</p>
                    )}
                  </div>
                )}

                {/* Staff — role */}
                {accountType === "staff" && (
                  <div>
                    <label style={labelStyle}>Your Role <span style={{ color: "#ef4444" }}>*</span></label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <button type="button" onClick={() => setRole("cashier")}
                        style={{ padding: "12px 0", borderRadius: 12, border: `2px solid ${role === "cashier" ? "#f97316" : "#e5e7eb"}`, background: role === "cashier" ? "#fff7ed" : "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, color: role === "cashier" ? "#ea580c" : "#374151" }}>
                        💰 Cashier
                      </button>
                      <button type="button" onClick={() => setRole("manager")}
                        style={{ padding: "12px 0", borderRadius: 12, border: `2px solid ${role === "manager" ? "#2563eb" : "#e5e7eb"}`, background: role === "manager" ? "#eff6ff" : "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, color: role === "manager" ? "#2563eb" : "#374151" }}>
                        🧑‍💼 Manager
                      </button>
                    </div>
                  </div>
                )}

                {/* Username */}
                <div>
                  <label style={labelStyle}>Username <span style={{ color: "#ef4444" }}>*</span></label>
                  <input type="text" name="username" value={form.username}
                    onChange={handleChange} placeholder="Choose a unique username"
                    style={inputStyle} />
                </div>

                {/* Email */}
                <div>
                  <label style={labelStyle}>Email <span style={{ color: "#ef4444" }}>*</span></label>
                  <input type="email" name="email" value={form.email}
                    onChange={handleChange} placeholder="Enter your email"
                    style={inputStyle} />
                </div>

                {/* Phone */}
                <div>
                  <label style={labelStyle}>Phone <span style={{ color: "#ef4444" }}>*</span></label>
                  <input type="tel" name="phone" value={form.phone}
                    onChange={handleChange} placeholder="10-digit phone number"
                    maxLength={10} style={inputStyle} />
                </div>

                {/* Password */}
                <div>
                  <label style={labelStyle}>Password <span style={{ color: "#ef4444" }}>*</span></label>
                  <input type="password" name="password" value={form.password}
                    onChange={handleChange} placeholder="Minimum 4 characters"
                    style={inputStyle} />
                </div>

                {/* Confirm Password */}
                <div>
                  <label style={labelStyle}>Confirm Password <span style={{ color: "#ef4444" }}>*</span></label>
                  <input type="password" name="confirmPassword" value={form.confirmPassword}
                    onChange={handleChange} placeholder="Re-enter your password"
                    style={inputStyle} />
                </div>

                <button type="submit" disabled={loading}
                  style={{ width: "100%", padding: "14px 0", background: loading ? "#fed7aa" : "#f97316", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 12px rgba(249,115,22,0.3)", marginTop: 4 }}>
                  {loading ? "Creating account..." : "Create Account"}
                </button>
              </form>

              <p style={{ textAlign: "center", fontSize: 13, color: "#9ca3af", marginTop: 16 }}>
                Already have an account?{" "}
                <Link href="/login" style={{ color: "#f97316", fontWeight: 700, textDecoration: "none" }}>Sign in</Link>
              </p>
            </div>
          )}
        </div>

        {/* Info box */}
        {accountType === "owner" && (
          <div style={{ marginTop: 14, padding: 14, background: "rgba(249,115,22,0.08)", borderRadius: 12, border: "1px solid rgba(249,115,22,0.2)", textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "#ea580c", fontWeight: 600, margin: 0 }}>
              🔑 After registering you will get a Restaurant Code to share with your staff
            </p>
          </div>
        )}
      </div>
    </div>
  );
}