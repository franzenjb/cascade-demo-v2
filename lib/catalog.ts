/**
 * Semantic catalog loader for Cascade V2.
 *
 * Loads data/semantic_catalog.json and exposes lookup + compaction helpers
 * used by the tool-use loop and system prompt builder.
 */

import type {
  SemanticCatalog,
  LayerDefinition,
  DisasterType,
} from "./types";
import catalogData from "../data/semantic_catalog.json";

const catalog = catalogData as unknown as SemanticCatalog;

export function getLayerById(layerId: string): LayerDefinition | null {
  return catalog.layers.find((l) => l.id === layerId) || null;
}

export function findLayersForQuery(
  query: string,
  disasterType?: DisasterType
): LayerDefinition[] {
  const q = query.toLowerCase();
  const matches: Array<{ layer: LayerDefinition; score: number }> = [];

  for (const layer of catalog.layers) {
    let score = 0;
    for (const alias of layer.aliases) {
      if (q.includes(alias.toLowerCase())) score += 10;
    }
    if (q.includes(layer.display_name.toLowerCase())) score += 5;
    if (disasterType) {
      const rel = layer.disaster_relevance[disasterType];
      if (rel === "high") score *= 2;
      else if (rel === "medium") score *= 1.5;
      else if (rel === "low") score *= 0.8;
    }
    if (score > 0) matches.push({ layer, score });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.map((m) => m.layer);
}

export function getPlaybookLayers(disasterType: string): string[] {
  return catalog.disaster_playbooks[disasterType]?.default_layers || [];
}

export function getPlaybookNarrative(disasterType: string): string[] {
  return catalog.disaster_playbooks[disasterType]?.narrative_structure || [];
}

export function getCatalogForSystemPrompt(): string {
  const compactLayers = catalog.layers.map((layer) => ({
    id: layer.id,
    source: layer.source,
    source_ref: layer.source_ref,
    display_name: layer.display_name,
    aliases: layer.aliases,
    disaster_relevance: layer.disaster_relevance,
    why_it_matters: layer.why_it_matters,
    schema: layer.schema,
    access_tier: layer.access_tier,
  }));

  return JSON.stringify(
    {
      catalog_version: catalog.catalog_version,
      county_context: catalog.county_context,
      data_notice: catalog.data_notice,
      layers: compactLayers,
      disaster_playbooks: catalog.disaster_playbooks,
    },
    null,
    2
  );
}

export function getFullCatalog(): SemanticCatalog {
  return catalog;
}
