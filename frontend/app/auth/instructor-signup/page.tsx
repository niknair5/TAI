"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { isEduEmail, signupInstructor, loginWithBackend } from "@/lib/api";

export default function InstructorSignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!isEduEmail(email)) {
      setError("Use your .edu email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await signupInstructor(email, password, fullName);
      await loginWithBackend(email, password);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 border border-tai-blue/10 rounded-xl p-8 shadow-sm bg-white">
        <div>
          <h1 className="font-serif text-2xl text-tai-blue">Create instructor account</h1>
          <p className="text-sm text-ink/45 mt-1">University .edu email required</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            disabled={loading}
          />
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
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            disabled={loading}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign up"}
          </Button>
        </form>
        <p className="text-sm text-center text-ink/45">
          Already have an account?{" "}
          <Link href="/auth/instructor-login" className="text-tai-blue font-medium hover:underline">
            Sign in
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
