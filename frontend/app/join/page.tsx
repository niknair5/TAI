"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft } from "lucide-react";
import { validateJoinCode } from "@/lib/api";

const CODE_CHARS = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/i;

function JoinForm() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalized = code.trim().toUpperCase().replace(/\s/g, "");
    if (!CODE_CHARS.test(normalized)) {
      setError("Enter an 8-character join code (letters A–Z excluding I, L, O and digits 2–9).");
      return;
    }
    setLoading(true);
    try {
      const res = await validateJoinCode(normalized);
      if (!res) {
        setError("Invalid join code.");
        return;
      }
      const q = new URLSearchParams({ code: normalized });
      if (nextPath) q.set("next", nextPath);
      router.push(`/auth/student-signup?${q.toString()}`);
    } catch {
      setError("Could not verify the code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="font-serif text-3xl text-tai-blue mb-2">Join with a code</h1>
        <p className="text-sm text-ink/50">
          Enter the join code your instructor shared (8 characters).
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          placeholder="e.g. X7K2M9NP"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="font-mono text-center text-lg tracking-widest"
          maxLength={8}
          autoComplete="off"
          disabled={loading}
          aria-invalid={!!error}
        />
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading || code.trim().length < 8}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
        </Button>
      </form>
      <p className="text-center text-xs text-ink/40">
        You&apos;ll create a student account with your .edu email on the next step.
      </p>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="border-b border-black/10 px-6 py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-ink/50 hover:text-tai-blue transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <Suspense
          fallback={
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-tai-blue" />
            </div>
          }
        >
          <JoinForm />
        </Suspense>
      </main>
    </div>
  );
}
