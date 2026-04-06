"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { isEduEmail, signupStudent, loginWithBackend } from "@/lib/api";

function StudentSignupForm() {
  const searchParams = useSearchParams();
  const code = (searchParams.get("code") || "").trim().toUpperCase();
  const nextPath = searchParams.get("next");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!code) {
    return (
      <div className="text-center space-y-4">
        <p className="text-ink/50">Missing join code.</p>
        <Button asChild variant="outline">
          <Link href="/join">Enter join code</Link>
        </Button>
      </div>
    );
  }

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
      const data = await signupStudent(email, password, fullName, code);
      await loginWithBackend(email, password);
      const dest =
        nextPath ||
        (data.course_id ? `/course/${data.course_id}` : "/");
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-ink/40 font-mono text-center">
        Join code: <span className="text-tai-blue font-semibold">{code}</span>
      </p>
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
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create account & join course"}
      </Button>
    </form>
  );
}

export default function StudentSignupPage() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 border border-tai-blue/10 rounded-xl p-8 shadow-sm bg-white">
        <div>
          <h1 className="font-serif text-2xl text-tai-blue">Student sign up</h1>
          <p className="text-sm text-ink/45 mt-1">.edu email required</p>
        </div>
        <Suspense
          fallback={
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-tai-blue" />
            </div>
          }
        >
          <StudentSignupForm />
        </Suspense>
        <p className="text-xs text-center">
          <Link href="/join" className="text-ink/35 hover:text-tai-blue">
            ← Different code
          </Link>
        </p>
      </div>
    </div>
  );
}
