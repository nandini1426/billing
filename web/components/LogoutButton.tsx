"use client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const user = userStr ? JSON.parse(userStr) : null;

  return (
    <div className="flex items-center gap-3">
      {user && (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-orange-600">
              {user.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900 leading-none">{user.username}</p>
            <p className="text-xs text-orange-500 capitalize">{user.role}</p>
          </div>
        </div>
      )}
      <button
        onClick={handleLogout}
        title="Logout"
        className="w-9 h-9 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>
    </div>
  );
}