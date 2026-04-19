"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage, MapInstruction } from "@/lib/types";

interface Props {
  messages: ChatMessage[];
  onUserMessage: (msg: ChatMessage) => void;
  onAssistantDelta: (text: string) => void;
  onMapInstruction: (m: MapInstruction) => void;
  onTurnEnd: () => void;
  onToolCall?: (name: string) => void;
  onToolResult?: (name: string, parsed: Record<string, unknown>) => void;
  streaming: boolean;
  setStreaming: (v: boolean) => void;
  triggerDirective?: string | null;
  scenarioId?: string | null;
  onTriggerConsumed?: () => void;
  toolActivity?: string | null;
}

export default function ChatPanel({
  messages,
  onUserMessage,
  onAssistantDelta,
  onMapInstruction,
  onTurnEnd,
  onToolCall,
  onToolResult,
  streaming,
  setStreaming,
  triggerDirective,
  scenarioId,
  onTriggerConsumed,
  toolActivity,
}: Props) {
  const [input, setInput] = useState("");
  const consumedRef = useRef<string | null>(null);

  const runRequest = async (
    text: string,
    directive: string | null,
    sid: string | null,
  ) => {
    const userMsg: ChatMessage = { role: "user", content: text };
    onUserMessage(userMsg);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: messages,
          message: text,
          trigger_directive: directive || undefined,
          scenario_id: sid || undefined,
        }),
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.replace(/^data:\s?/, "");
          if (!line || line === "[DONE]") continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === "text" && evt.content) {
              onAssistantDelta(evt.content);
            } else if (evt.type === "map_instruction" && evt.mapInstruction) {
              onMapInstruction(evt.mapInstruction);
            } else if (evt.type === "tool_call" && evt.toolName) {
              onToolCall?.(evt.toolName);
            } else if (evt.type === "tool_result" && evt.toolName && evt.toolResult) {
              try {
                const parsed = JSON.parse(evt.toolResult);
                if (parsed && typeof parsed === "object") {
                  onToolResult?.(evt.toolName, parsed as Record<string, unknown>);
                }
              } catch {
                // non-JSON tool result — skip structured forward
              }
            } else if (evt.type === "error") {
              onAssistantDelta(`\n\n[Error: ${evt.error}]`);
            }
          } catch {
            // skip malformed line
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onAssistantDelta(`\n\n[Network error: ${msg}]`);
    } finally {
      setStreaming(false);
      onTurnEnd();
    }
  };

  const submit = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    await runRequest(text, null, null);
  };

  useEffect(() => {
    if (!triggerDirective) return;
    if (streaming) return;
    if (consumedRef.current === triggerDirective) return;
    consumedRef.current = triggerDirective;
    const sid = scenarioId ?? null;
    runRequest(
      "Produce the proactive situational briefing.",
      triggerDirective,
      sid,
    );
    onTriggerConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerDirective, streaming]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="text-arc-gray-500 dark:text-arc-gray-300 text-sm">
            <p className="font-headline text-lg text-arc-gray-900 dark:text-arc-cream mb-2">
              Pinellas County, FL
            </p>
            <p className="mb-2">
              Press <span className="font-semibold text-arc-red">Simulate NWS Tornado Alert</span> to see the anticipatory briefing — Claude produces the situational report before you type a thing.
            </p>
            <p>Or ask directly:</p>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>What are the most vulnerable tracts in Pinellas?</li>
              <li>How many FEMA declarations has this county had?</li>
              <li>Which tracts have the highest hurricane risk?</li>
              <li>Give me a disaster-readiness briefing.</li>
            </ul>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block max-w-[90%] px-3 py-2 rounded text-sm text-left ${
                m.role === "user"
                  ? "bg-arc-info text-white"
                  : "bg-arc-gray-100 dark:bg-arc-gray-900 text-arc-gray-900 dark:text-arc-cream"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {streaming && toolActivity && (
          <div className="flex items-center gap-2 text-[10px] font-data uppercase tracking-wider text-arc-gray-500 dark:text-arc-gray-300">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-arc-red animate-pulse" />
            Calling <span className="font-semibold text-arc-maroon dark:text-arc-cream">{toolActivity}</span>
          </div>
        )}
      </div>
      <div className="border-t border-arc-gray-100 dark:border-arc-gray-700 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            disabled={streaming}
            placeholder={streaming ? "Thinking…" : "Ask about Pinellas County…"}
            className="flex-1 px-3 py-2 text-sm rounded border border-arc-gray-300 bg-white text-arc-gray-900 placeholder:text-arc-gray-500 dark:bg-arc-black dark:border-arc-gray-700 dark:text-arc-cream dark:placeholder:text-arc-gray-300 focus:outline-none focus:border-arc-red"
          />
          <button
            onClick={submit}
            disabled={streaming || !input.trim()}
            className="px-4 py-2 text-sm font-semibold bg-arc-red text-white rounded disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
