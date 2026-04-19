"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type {
  ChatMessage,
  GeoJSONPolygon,
  MapInstruction,
} from "@/lib/types";
import ChatPanel from "@/components/ChatPanel";
import TriggerButton from "@/components/TriggerButton";
import LayerPanel from "@/components/LayerPanel";
import type { AssetLayerVisibility } from "@/components/MapView";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const CENTER: [number, number] = [
  Number(process.env.NEXT_PUBLIC_MAP_CENTER_LNG ?? -82.75),
  Number(process.env.NEXT_PUBLIC_MAP_CENTER_LAT ?? 27.88),
];
const ZOOM = Number(process.env.NEXT_PUBLIC_MAP_ZOOM ?? 10);

const DEFAULT_VISIBILITY: AssetLayerVisibility = {
  red_cross: true,
  hospital: true,
  mobile_home_park: true,
  school: false,
  fire_station: false,
  police_station: false,
};

interface ActiveWarning {
  nwsEventId: string;
  expires: string;
  scenarioId: string;
}

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [instructions, setInstructions] = useState<MapInstruction[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [triggerDirective, setTriggerDirective] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [clearSignal, setClearSignal] = useState(0);
  const [focusTarget, setFocusTarget] = useState<
    { center: [number, number]; zoom: number } | null
  >(null);
  const [assetVisibility, setAssetVisibility] =
    useState<AssetLayerVisibility>(DEFAULT_VISIBILITY);
  const [activeWarning, setActiveWarning] = useState<ActiveWarning | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (!activeWarning) {
      setCountdown(null);
      return;
    }
    const tick = () => {
      const diffMs = new Date(activeWarning.expires).getTime() - Date.now();
      if (diffMs <= 0) {
        setCountdown("EXPIRED");
        return;
      }
      const m = Math.floor(diffMs / 60000);
      const s = Math.floor((diffMs % 60000) / 1000);
      setCountdown(`${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeWarning]);

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

  const handleTriggerFired = (payload: {
    directive: string;
    polygon: unknown;
    scenarioId: string;
    focusCenter: [number, number];
    focusZoom: number;
    nwsEventId: string;
    expires: string;
  }) => {
    setMessages([]);
    setInstructions([]);
    setClearSignal((n) => n + 1);
    setFocusTarget({ center: payload.focusCenter, zoom: payload.focusZoom });
    setInstructions([
      {
        action: "draw",
        geometry: payload.polygon as GeoJSONPolygon,
        style: { color: "#ED1B2E", opacity: 0.14, label: "Tornado Warning" },
        layer_label: "Tornado Warning",
      },
    ]);
    setScenarioId(payload.scenarioId);
    setTriggerDirective(payload.directive);
    setActiveWarning({
      nwsEventId: payload.nwsEventId,
      expires: payload.expires,
      scenarioId: payload.scenarioId,
    });
  };

  return (
    <main className="h-screen flex flex-col bg-arc-cream dark:bg-arc-black">
      <header className="bg-arc-maroon text-white shadow-md">
        <div className="px-4 py-2 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-arc-red" aria-hidden />
            <div>
              <h1 className="font-headline text-lg leading-tight">
                Cascade <span className="text-white/60 text-xs font-data uppercase tracking-widest">v2</span>
              </h1>
              <p className="text-[10px] font-data uppercase tracking-widest text-white/70">
                Pinellas County · FL · Operational Briefing Layer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 flex-wrap">
            <Stat label="Population" value="959,107" />
            <Stat label="Census Tracts" value="245" />
            <Stat label="FEMA Declarations" value="36" />
            <Stat label="% Struggling (ALICE)" value="25.2%" />
            {activeWarning && (
              <div className="flex items-center gap-2 px-3 py-1 bg-arc-red/20 border border-arc-red animate-pulse">
                <span className="w-2 h-2 bg-arc-red rounded-full" />
                <div className="flex flex-col leading-tight">
                  <span className="text-[9px] font-data uppercase tracking-widest text-white/80">
                    Active Warning
                  </span>
                  <span className="text-[11px] font-data font-semibold">
                    {activeWarning.nwsEventId} · {countdown}
                  </span>
                </div>
              </div>
            )}
            <TriggerButton onFired={handleTriggerFired} />
          </div>
        </div>
        <div className="h-[2px] bg-arc-red" />
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[2fr_1fr] min-h-0">
        <div className="min-h-[50vh] lg:min-h-0 relative">
          <MapView
            center={CENTER}
            zoom={ZOOM}
            instructions={instructions}
            clearSignal={clearSignal}
            focusTarget={focusTarget}
            assetVisibility={assetVisibility}
          />
          <LayerPanel
            visibility={assetVisibility}
            onChange={setAssetVisibility}
          />
        </div>
        <div className="border-l border-arc-gray-100 dark:border-arc-gray-700 flex flex-col min-h-0 bg-white dark:bg-arc-gray-900">
          <ChatPanel
            messages={messages}
            onUserMessage={onUserMessage}
            onAssistantDelta={onAssistantDelta}
            onMapInstruction={onMapInstruction}
            onTurnEnd={onTurnEnd}
            streaming={streaming}
            setStreaming={setStreaming}
            triggerDirective={triggerDirective}
            scenarioId={scenarioId}
            onTriggerConsumed={() => setTriggerDirective(null)}
          />
        </div>
      </div>

      <footer className="border-t border-arc-gray-100 dark:border-arc-gray-700 px-4 py-2 text-[10px] text-arc-gray-500 dark:text-arc-gray-300 font-data uppercase tracking-wider flex items-center justify-between">
        <span>CDC SVI · FEMA NRI · ALICE · OpenFEMA · TIGERweb · FL Parcels · Pinellas Assets</span>
        <span>
          Sibling of{" "}
          <a href="https://github.com/franzenjb/cascade-demo" className="underline hover:text-arc-maroon">
            cascade-demo
          </a>{" "}
          &amp;{" "}
          <a href="https://ops.jbf.com" className="underline hover:text-arc-maroon">
            ops.jbf.com
          </a>
        </span>
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[9px] font-data uppercase tracking-widest text-white/60">
        {label}
      </span>
      <span className="text-sm font-data font-semibold">{value}</span>
    </div>
  );
}
