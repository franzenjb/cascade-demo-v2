"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { ChatMessage, MapInstruction } from "@/lib/types";
import ChatPanel from "@/components/ChatPanel";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const CENTER: [number, number] = [
  Number(process.env.NEXT_PUBLIC_MAP_CENTER_LNG ?? -82.4572),
  Number(process.env.NEXT_PUBLIC_MAP_CENTER_LAT ?? 27.9506),
];
const ZOOM = Number(process.env.NEXT_PUBLIC_MAP_ZOOM ?? 9);

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [instructions, setInstructions] = useState<MapInstruction[]>([]);
  const [streaming, setStreaming] = useState(false);

  const onUserMessage = (m: ChatMessage) => {
    setMessages((prev) => [...prev, m, { role: "assistant", content: "" }]);
  };

  const onAssistantDelta = (text: string) => {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === "assistant") {
        copy[copy.length - 1] = { ...last, content: last.content + text };
      }
      return copy;
    });
  };

  const onMapInstruction = (m: MapInstruction) => {
    setInstructions((prev) => [...prev, m]);
  };

  const onTurnEnd = () => {
    // placeholder for future end-of-turn handling
  };

  return (
    <main className="h-screen flex flex-col">
      <header className="border-b border-arc-gray-100 dark:border-arc-gray-700 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl text-arc-gray-900 dark:text-arc-cream">
            Cascade Demo <span className="text-arc-red">V2</span>
          </h1>
          <p className="text-xs text-arc-gray-500 dark:text-arc-gray-300 font-data uppercase tracking-wider">
            Hillsborough County, FL · Real Public Data
          </p>
        </div>
        <div className="text-xs text-arc-gray-500 dark:text-arc-gray-300">
          CDC SVI · FEMA NRI · ALICE · OpenFEMA · TIGERweb · FL Parcels
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[2fr_1fr] min-h-0">
        <div className="min-h-[50vh] lg:min-h-0 relative">
          <MapView center={CENTER} zoom={ZOOM} instructions={instructions} />
        </div>
        <div className="border-l border-arc-gray-100 dark:border-arc-gray-700 flex flex-col min-h-0">
          <ChatPanel
            messages={messages}
            onUserMessage={onUserMessage}
            onAssistantDelta={onAssistantDelta}
            onMapInstruction={onMapInstruction}
            onTurnEnd={onTurnEnd}
            streaming={streaming}
            setStreaming={setStreaming}
          />
        </div>
      </div>

      <footer className="border-t border-arc-gray-100 dark:border-arc-gray-700 px-4 py-2 text-xs text-arc-gray-500 dark:text-arc-gray-300">
        Public-record data only. Sibling of{" "}
        <a href="https://github.com/franzenjb/cascade-demo" className="underline">
          cascade-demo
        </a>{" "}
        and{" "}
        <a href="https://ops.jbf.com" className="underline">
          ops.jbf.com
        </a>
        .
      </footer>
    </main>
  );
}
