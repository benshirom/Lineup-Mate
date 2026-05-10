import Link from 'next/link';
import React from 'react';
import { useAuth } from '@/lib/AuthContext';

const Navbar: React.FC = () => {
  const { user, supabase } = useAuth();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav className="bg-gray-900 text-white p-4 flex items-center justify-between">
      <div className="flex items-center gap-5">
        <Link href="/" className="font-bold text-lg">
          Lineup-Mate
        </Link>
        {user && (
          <Link href="/admin" className="text-sm text-gray-200 hover:text-white">
            Admin
          </Link>
        )}
      </div>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="hidden sm:inline text-sm text-gray-200">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="bg-red-600 hover:bg-red-700 rounded px-3 py-1 text-sm"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link href="/login" className="bg-blue-600 hover:bg-blue-700 rounded px-3 py-1 text-sm">
            Login
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
