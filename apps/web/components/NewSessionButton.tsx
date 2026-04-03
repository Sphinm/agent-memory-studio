"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

export default function NewSessionButton() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Session ${new Date().toLocaleString()}` }),
      });
      if (res.ok) {
        const session = await res.json();
        router.push(`/sessions/${session.id}`);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <button className="btn-new-session" onClick={create} disabled={creating}>
      {creating ? "Creating…" : "+ New Session"}
    </button>
  );
}
