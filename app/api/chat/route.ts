/**
 * POST /api/chat
 *
 * Streams Claude's response back to the frontend as Server-Sent Events.
 * Tool calls execute server-side; map instructions are forwarded as SSE so
 * the MapLibre view can render them.
 */

import { NextRequest } from "next/server";
import { chatWithTools, type ChatStreamEvent } from "@/lib/claude";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequest {
  history: ChatMessage[];
  message: string;
  trigger_directive?: string;
  scenario_id?: string;
}

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.message || typeof body.message !== "string") {
    return new Response(JSON.stringify({ error: "Missing 'message' field" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Truncate history to avoid token overflow: keep the first message
  // (trigger briefing context) and the most recent exchanges.
  const MAX_HISTORY = 20;
  const history = body.history || [];
  const trimmedHistory =
    history.length > MAX_HISTORY
      ? [history[0], ...history.slice(-(MAX_HISTORY - 1))]
      : history;

  // When a trigger fires (NWS warning, scenario replay, etc.), the frontend
  // sends the generated [SYSTEM EVENT] directive as `trigger_directive`.
  // Prepend it to the user message so Claude's tool-use loop sees it first.
  const userMessage = body.trigger_directive
    ? `${body.trigger_directive}\n\n---\n\nUser follow-up: ${body.message}`
    : body.message;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        for await (const event of chatWithTools(trimmedHistory, userMessage)) {
          emit(event);
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emit({ type: "error", error: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
