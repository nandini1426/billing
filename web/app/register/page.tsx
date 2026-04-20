"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const router = useRouter();

  const [accountType, setAccountType] = useState<"owner" | "staff" | null>(null);
  const [loading, setLoading] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantCode, setRestaurantCode] = useState("");
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [codeRestaurantName, setCodeRestaurantName] = useState("");
  const [role, setRole] = useState<"manager" | "cashier">("cashier");

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Validate restaurant code in real time
  const handleCodeChange = async (code: string) => {
    setRestaurantCode(code.toUpperCase());
    setCodeValid(null);
    setCodeRestaurantName("");
    if (code.length < 11) return;
    try {
      const res = await api.post('/restaurants/validate-code', {
        code: code.toUpperCase()
      });
      if (res.data.valid) {
        setCodeValid(true);
        setCodeRestaurantName(res.data.restaurant.name);
      }
    } catch {
      setCodeValid(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accountType)
      return toast.error("Select account type first");
    if (!form.username || form.username.length < 3)
      return toast.error("Username must be at least 3 characters");
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return toast.error("Invalid email");
    if (!form.password || form.password.length < 4)
      return toast.error("Password must be at least 4 characters");
    if (form.password !== form.confirmPassword)
      return toast.error("Passwords do not match");
    if (!form.phone)
      return toast.error("Phone number required");
    if (accountType === "owner" && !restaurantName.trim())
      return toast.error("Restaurant name is required");
    if (accountType === "staff" && !codeValid)
      return toast.error("Enter a valid restaurant code");

    setLoading(true);
    try {
      await api.post('/auth/register', {
        username:         form.username,
        email:            form.email,
        password:         form.password,
        phone:            form.phone,
        role:             accountType === "owner" ? "admin" : role,
        restaurant_name:  accountType === "owner" ? restaurantName : undefined,
        restaurant_code:  accountType === "staff" ? restaurantCode : undefined,
      });

      toast.success(
        accountType === "owner"
          ? "Restaurant created! Please sign in."
          : "Account created! Please sign in."
      );
      router.push("/login");
    } catch (err: any) {
      toast.error(err.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 py-8">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">🍽️</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">BillEase</h1>
          <p className="text-gray-500 mt-1">Create your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">

          {/* Account type selector */}
          {!accountType && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Who are you?
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Select your account type to get started
              </p>
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setAccountType("owner")}
                  className="p-6 border-2 border-orange-200 rounded-2xl hover:border-orange-500 hover:bg-orange-50 transition text-left"
                >
                  <div className="text-3xl mb-2">🏪</div>
                  <div className="font-bold text-gray-900 text-lg">
                    Restaurant Owner
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Create a new restaurant account. You will get a unique
                    code to share with your staff.
                  </div>
                </button>

                <button
                  onClick={() => setAccountType("staff")}
                  className="p-6 border-2 border-blue-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition text-left"
                >
                  <div className="text-3xl mb-2">👤</div>
                  <div className="font-bold text-gray-900 text-lg">
                    Staff Member
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Join an existing restaurant. You will need the
                    restaurant code from your owner.
                  </div>
                </button>
              </div>

              <p className="text-center text-sm text-gray-500 mt-6">
                Already have an account?{" "}
                <Link href="/login" className="text-orange-500 font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          )}

          {/* Registration form */}
          {accountType && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setAccountType(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ←
                </button>
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">
                    {accountType === "owner"
                      ? "🏪 Restaurant Owner"
                      : "👤 Staff Member"}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {accountType === "owner"
                      ? "Creates a new restaurant"
                      : "Joins an existing restaurant"}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Owner — restaurant name */}
                {accountType === "owner" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Restaurant Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={restaurantName}
                      onChange={e => setRestaurantName(e.target.value)}
                      placeholder="e.g. Barkaas Arabic Restaurant"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900"
                    />
                  </div>
                )}

                {/* Staff — restaurant code */}
                {accountType === "staff" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Restaurant Code <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={restaurantCode}
                      onChange={e => handleCodeChange(e.target.value)}
                      placeholder="e.g. REST-ABC123"
                      maxLength={11}
                      className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900 font-mono uppercase ${
                        codeValid === true
                          ? "border-green-400 bg-green-50"
                          : codeValid === false
                          ? "border-red-400 bg-red-50"
                          : "border-gray-200"
                      }`}
                    />
                    {codeValid === true && (
                      <p className="text-green-600 text-xs mt-1 font-medium">
                        ✅ Valid code — {codeRestaurantName}
                      </p>
                    )}
                    {codeValid === false && (
                      <p className="text-red-500 text-xs mt-1">
                        ❌ Invalid restaurant code
                      </p>
                    )}
                  </div>
                )}

                {/* Staff — role selection */}
                {accountType === "staff" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Your Role <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRole("cashier")}
                        className={`p-3 rounded-xl border-2 transition text-sm font-medium ${
                          role === "cashier"
                            ? "border-orange-500 bg-orange-50 text-orange-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        💰 Cashier
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole("manager")}
                        className={`p-3 rounded-xl border-2 transition text-sm font-medium ${
                          role === "manager"
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        🧑‍💼 Manager
                      </button>
                    </div>
                  </div>
                )}

                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Username <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    placeholder="Choose a unique username"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Phone <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="10-digit phone number"
                    maxLength={10}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Password <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Minimum 4 characters"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900"
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Confirm Password <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter your password"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-xl transition shadow-md mt-2"
                >
                  {loading ? "Creating account..." : "Create Account"}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Already have an account?{" "}
                <Link href="/login" className="text-orange-500 font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Restaurant code info for owners */}
        {accountType === "owner" && (
          <div className="mt-4 p-4 bg-orange-50 rounded-xl border border-orange-100">
            <p className="text-xs text-orange-700 font-medium text-center">
              🔑 After registering, you will get a unique Restaurant Code
              to share with your managers and cashiers
            </p>
          </div>
        )}
      </div>
    </div>
  );
}