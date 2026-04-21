/**
 * Claude API wrapper with tool-use support.
 *
 * Ported from cascade1 with MapLibre/Supabase tool set. Streams tokens
 * via an async generator; callers flush to the frontend as SSE.
 */

import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "./prompts";
import { toolDefinitions, executeToolCall } from "./tools";
import type { ChatMessage, MapInstruction } from "./types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const MAX_TOKENS = 8192;
const MAX_TOOL_ITERATIONS = 8;

export interface ChatStreamEvent {
  type: "text" | "tool_call" | "tool_result" | "map_instruction" | "done" | "error";
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  mapInstruction?: MapInstruction;
  error?: string;
}

export async function* chatWithTools(
  history: ChatMessage[],
  userMessage: string
): AsyncGenerator<ChatStreamEvent> {
  const systemBlocks = buildSystemPrompt();

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    try {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemBlocks,
        tools: toolDefinitions,
        messages,
      });

      const toolCalls: Array<{
        id: string;
        name: string;
        input: Record<string, unknown>;
      }> = [];

      for await (const event of stream) {
        if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            yield { type: "text", content: event.delta.text };
          }
        }
      }

      const finalMessage = await stream.finalMessage();

      for (const block of finalMessage.content) {
        if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          });
        }
      }

      if (toolCalls.length === 0) {
        yield { type: "done" };
        return;
      }

      messages.push({
        role: "assistant",
        content: finalMessage.content,
      });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const call of toolCalls) {
        yield {
          type: "tool_call",
          toolName: call.name,
          toolInput: call.input,
        };

        try {
          const result = await executeToolCall(call.name, call.input);

          if (result.mapInstruction) {
            yield {
              type: "map_instruction",
              mapInstruction: result.mapInstruction,
            };
          }

          yield {
            type: "tool_result",
            toolName: call.name,
            toolResult: result.content,
          };

          toolResults.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: result.content,
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          yield {
            type: "tool_result",
            toolName: call.name,
            toolResult: `Error: ${errorMessage}`,
          };
          toolResults.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: `Error: ${errorMessage}`,
            is_error: true,
          });
        }
      }

      messages.push({
        role: "user",
        content: toolResults,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      yield { type: "error", error: errorMessage };
      return;
    }
  }

  yield {
    type: "error",
    error: `Exceeded max tool-use iterations (${MAX_TOOL_ITERATIONS}).`,
  };
}
