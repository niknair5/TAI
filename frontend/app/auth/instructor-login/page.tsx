"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { API_URL, isEduEmail, loginWithBackend } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

export default function InstructorLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isEduEmail(email)) {
      setError("Use your .edu email address.");
      return;
    }
    setLoading(true);
    try {
      await loginWithBackend(email, password);
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const me = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!me.ok) throw new Error("Could not load profile");
      const row = (await me.json()) as { role: string };
      if (row.role !== "instructor") {
        await supabase.auth.signOut();
        throw new Error("This account is not an instructor account. Use student sign in.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 border border-tai-blue/10 rounded-xl p-8 shadow-sm bg-white">
        <div>
          <h1 className="font-serif text-2xl text-tai-blue">Instructor sign in</h1>
          <p className="text-sm text-ink/45 mt-1">.edu email and password</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>
        <p className="text-sm text-center text-ink/45">
          New instructor?{" "}
          <Link href="/auth/instructor-signup" className="text-tai-blue font-medium hover:underline">
            Create an account
          </Link>
        </p>
        <p className="text-xs text-center">
          <Link href="/" className="text-ink/35 hover:text-tai-blue">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
