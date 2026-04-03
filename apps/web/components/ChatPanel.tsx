"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import VoiceInput from "./VoiceInput";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
}

export default function ChatPanel({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/chat/models`)
      .then((r) => r.json())
      .then((data: { models: ModelConfig[]; defaultModel: string }) => {
        setModels(data.models);
        setSelectedModel(data.defaultModel);
      })
      .catch(() => {});
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/chat/${sessionId}/messages`);
      if (res.ok) setMessages(await res.json());
    } catch { /* ignore */ }
  }, [sessionId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || sending) return;

    setInput("");
    setError(null);
    setSending(true);

    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      sessionId,
      role: "user",
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`${API_BASE}/api/v1/chat/${sessionId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), model: selectedModel }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Error ${res.status}`);
      }

      const assistantMsg: ChatMessage = await res.json();
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [sending, sessionId, selectedModel]);

  const send = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleVoiceTranscript = useCallback((text: string) => {
    setInput((prev) => {
      const combined = prev ? prev + " " + text : text;
      return combined;
    });
    inputRef.current?.focus();
  }, []);

  const handleVoicePartial = useCallback((text: string) => {
    setInput(text);
  }, []);

  const currentModelName = models.find((m) => m.id === selectedModel)?.name || selectedModel;

  return (
    <div className="chat-panel">
      <div className="chat-toolbar">
        <label className="chat-model-label">Model</label>
        <select
          className="chat-model-select"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={sending}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.provider})
            </option>
          ))}
        </select>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            Send a message or use the mic to start chatting.
            <br />
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
              Using {currentModelName} · Session memories as context
            </span>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble chat-bubble--${m.role}`}>
            <div className="chat-bubble-role">{m.role === "user" ? "You" : "Assistant"}</div>
            <div className="chat-bubble-content">{m.content}</div>
            <div className="chat-bubble-time">
              {new Date(m.createdAt).toLocaleTimeString()}
            </div>
          </div>
        ))}
        {sending && (
          <div className="chat-bubble chat-bubble--assistant">
            <div className="chat-bubble-role">Assistant</div>
            <div className="chat-bubble-content chat-typing">Thinking ({currentModelName})…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="chat-error">
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
      )}

      <div className="chat-input-row">
        <VoiceInput
          onTranscript={handleVoiceTranscript}
          onPartial={handleVoicePartial}
          disabled={sending}
        />
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type or speak…"
          rows={1}
          disabled={sending}
        />
        <button className="chat-send" onClick={send} disabled={sending || !input.trim()}>
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
