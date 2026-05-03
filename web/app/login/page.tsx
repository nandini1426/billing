"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import api from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return toast.error("Username is required");
    if (!password.trim()) return toast.error("Password is required");

    setLoading(true);
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await api.post('/auth/login', { username, password });
        const { token, user } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        toast.success(`Welcome back, ${user.username}!`);
        router.push("/dashboard");
        setLoading(false);
        return;
      } catch (err: any) {
        lastError = err;
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    setLoading(false);
    toast.error(lastError?.error || "Login failed. Please try again.");
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)",
      padding: "20px 16px",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72,
            background: "#f97316",
            borderRadius: 20,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 8px 24px rgba(249,115,22,0.3)",
            fontSize: 36,
          }}>
            🍽️
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: 0 }}>BillEase</h1>
          <p style={{ color: "#9ca3af", fontSize: 14, marginTop: 4 }}>Restaurant Billing System</p>
        </div>

        {/* Card */}
        <div style={{
          background: "#fff",
          borderRadius: 20,
          padding: 28,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          border: "1px solid #f3f4f6",
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 24 }}>
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                style={{
                  width: "100%", padding: "12px 14px",
                  border: "1.5px solid #e5e7eb", borderRadius: 12,
                  fontSize: 15, color: "#111827", outline: "none",
                  background: "#f9fafb",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{
                    width: "100%", padding: "12px 44px 12px 14px",
                    border: "1.5px solid #e5e7eb", borderRadius: 12,
                    fontSize: 15, color: "#111827", outline: "none",
                    background: "#f9fafb",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute", right: 12, top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", fontSize: 18,
                  }}>
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "14px 0",
                background: loading ? "#fed7aa" : "#f97316",
                color: "#fff", border: "none", borderRadius: 12,
                fontSize: 16, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                transition: "all .15s",
                boxShadow: "0 4px 12px rgba(249,115,22,0.3)",
              }}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: 13, color: "#9ca3af", marginTop: 20 }}>
            Don't have an account?{" "}
            <Link href="/register" style={{ color: "#f97316", fontWeight: 600, textDecoration: "none" }}>
              Create one
            </Link>
          </p>
        </div>

        <div style={{
          marginTop: 16, padding: 14,
          background: "rgba(249,115,22,0.08)",
          borderRadius: 12, border: "1px solid rgba(249,115,22,0.2)",
          textAlign: "center",
        }}>
          <p style={{ fontSize: 12, color: "#ea580c", fontWeight: 500, margin: 0 }}>
            🔑 First time? Go to Register to create an account
          </p>
        </div>
      </div>
    </div>
  );
}