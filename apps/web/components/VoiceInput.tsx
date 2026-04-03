"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

type SpeechRecognitionType = typeof window extends { SpeechRecognition: infer T } ? T : unknown;

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onPartial?: (text: string) => void;
  disabled?: boolean;
}

function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => SpeechRecognition) | null;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative { transcript: string; confidence: number; }
interface SpeechRecognitionErrorEvent { error: string; message: string; }

export default function VoiceInput({ onTranscript, onPartial, disabled }: VoiceInputProps) {
  const [mode, setMode] = useState<"idle" | "listening" | "recording" | "transcribing">("idle");
  const [supported, setSupported] = useState<"speech" | "recorder" | "none">("none");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    if (getSpeechRecognition()) {
      setSupported("speech");
    } else if (typeof MediaRecorder !== "undefined") {
      setSupported("recorder");
    }
  }, []);

  const startSpeechRecognition = useCallback(() => {
    const SRConstructor = getSpeechRecognition();
    if (!SRConstructor) return;

    const recognition = new SRConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "";
    recognitionRef.current = recognition;
    finalTranscriptRef.current = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        if (result.isFinal) {
          final += result[0]!.transcript;
        } else {
          interim += result[0]!.transcript;
        }
      }
      if (final) {
        finalTranscriptRef.current += final;
      }
      onPartial?.(finalTranscriptRef.current + interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      setMode("idle");
    };

    recognition.onend = () => {
      if (finalTranscriptRef.current.trim()) {
        onTranscript(finalTranscriptRef.current.trim());
      }
      setMode("idle");
    };

    recognition.start();
    setMode("listening");
  }, [onTranscript, onPartial]);

  const stopSpeechRecognition = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 1000) {
          setMode("idle");
          return;
        }
        setMode("transcribing");

        try {
          const form = new FormData();
          form.append("audio", blob, "recording.webm");
          const res = await fetch(`${API_BASE}/api/v1/chat/transcribe`, {
            method: "POST",
            body: form,
          });
          if (res.ok) {
            const data = await res.json();
            if (data.text?.trim()) onTranscript(data.text.trim());
          }
        } catch (e) {
          console.error("Transcription error:", e);
        }
        setMode("idle");
      };

      recorder.start(250);
      setMode("recording");
    } catch (e) {
      console.error("Microphone access error:", e);
    }
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const toggle = () => {
    if (disabled) return;
    if (mode === "listening") {
      stopSpeechRecognition();
    } else if (mode === "recording") {
      stopRecording();
    } else if (mode === "idle") {
      if (supported === "speech") startSpeechRecognition();
      else if (supported === "recorder") startRecording();
    }
  };

  if (supported === "none") return null;

  const isActive = mode === "listening" || mode === "recording";
  const title =
    mode === "listening" ? "Listening… click to stop"
    : mode === "recording" ? "Recording… click to stop"
    : mode === "transcribing" ? "Transcribing…"
    : "Voice input";

  return (
    <button
      className={`chat-voice ${isActive ? "chat-voice--active" : ""}`}
      onClick={toggle}
      disabled={disabled || mode === "transcribing"}
      title={title}
      type="button"
    >
      {mode === "transcribing" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" opacity="0.3" />
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
          </path>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill={isActive ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <line x1="12" y1="17" x2="12" y2="22" />
        </svg>
      )}
    </button>
  );
}
