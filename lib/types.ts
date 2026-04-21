/**
 * Shared TypeScript types for Cascade Demo V2.
 */

export type DisasterType =
  | "tornado"
  | "hurricane"
  | "hurricane_pre_landfall"
  | "wildfire"
  | "flood"
  | "winter_storm";

export type RelevanceLevel = "high" | "medium" | "low" | "none";
export type AccessTier = "public" | "internal" | "role-restricted" | "privacy-restricted";

export interface LayerDefinition {
  id: string;
  source: "supabase" | "tigerweb" | "parcel_api" | "none";
  source_ref: string;
  display_name: string;
  aliases: string[];
  disaster_relevance: Partial<Record<DisasterType, RelevanceLevel>>;
  why_it_matters: string;
  schema: Record<string, string>;
  access_tier: AccessTier;
  data_vintage: string;
  known_limitations: string;
}

export interface DisasterPlaybook {
  default_layers: string[];
  narrative_structure?: string[];
}

export interface SemanticCatalog {
  catalog_version: string;
  last_updated: string;
  data_notice: string;
  county_context: {
    name: string;
    state: string;
    fips: string;
    population: number;
    center: [number, number];
  };
  layers: LayerDefinition[];
  disaster_playbooks: Record<string, DisasterPlaybook>;
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: GeoJSONPolygon | GeoJSONPoint | { type: string; coordinates: unknown };
    properties?: Record<string, unknown> | null;
  }>;
}

export type GeoJSONGeometry =
  | GeoJSONPolygon
  | GeoJSONPoint
  | GeoJSONFeatureCollection;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type RiskMode = "off" | "svi" | "nri" | "combined";

export interface RiskFilter {
  mode: RiskMode;
  sviMin: number;
  nriMin: number;
}

export interface MapInstruction {
  action: "draw" | "clear" | "zoom_to" | "highlight";
  geometry?: GeoJSONGeometry;
  style?: {
    color?: string;
    opacity?: number;
    label?: string;
    lineWidth?: number;
    lineOpacity?: number;
  };
  layer_label?: string;
}
