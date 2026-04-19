export interface TractPopupProps {
  geoid: string;
  name: string;
  place: string;
  label: string;
  centroid_lng: number;
  centroid_lat: number;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  pop: number | null;
  svi_pct: number | null; // 0..1
  svi_theme1: number | null;
  svi_theme2: number | null;
  svi_theme3: number | null;
  svi_theme4: number | null;
  nri_score: number | null; // 0..100
  nri_hrcn: number | null;
  nri_cfld: number | null;
  nri_ifld: number | null;
  nri_trnd: number | null;
  nri_wfir: number | null;
  nri_hwav: number | null;
  combined_pct: number | null; // 0..100
}

function bandForPct(pct: number): string {
  if (pct >= 90) return "#7a0f1d";
  if (pct >= 75) return "#b51a2b";
  if (pct >= 50) return "#d97373";
  if (pct >= 25) return "#e9b7b7";
  return "#f3e6e6";
}

function bandForScore(score: number): string {
  if (score >= 80) return "#5b2b8c";
  if (score >= 60) return "#c0392b";
  if (score >= 40) return "#e07a3c";
  if (score >= 20) return "#e9c46a";
  return "#f5e8c6";
}

function fmtInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString();
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pctBar(
  label: string,
  val01: number | null,
  color = "#a51c30",
): string {
  if (val01 == null)
    return `<div class="tp-bar-row"><div class="tp-bar-head"><span>${escape(label)}</span><span class="tp-bar-head-val">—</span></div><div class="tp-bar-track"></div></div>`;
  const pct = Math.max(0, Math.min(100, Math.round(val01 * 100)));
  return `<div class="tp-bar-row">
    <div class="tp-bar-head"><span>${escape(label)}</span><span class="tp-bar-head-val">${pct}%</span></div>
    <div class="tp-bar-track"><div class="tp-bar-fill" style="width:${pct}%;background:${color}"></div></div>
  </div>`;
}

function scoreBar(
  label: string,
  val100: number | null,
): string {
  if (val100 == null)
    return `<div class="tp-bar-row"><div class="tp-bar-head"><span>${escape(label)}</span><span class="tp-bar-head-val">—</span></div><div class="tp-bar-track"></div></div>`;
  const v = Math.max(0, Math.min(100, Number(val100)));
  const color = bandForScore(v);
  return `<div class="tp-bar-row">
    <div class="tp-bar-head"><span>${escape(label)}</span><span class="tp-bar-head-val">${v.toFixed(1)}</span></div>
    <div class="tp-bar-track"><div class="tp-bar-fill" style="width:${v}%;background:${color}"></div></div>
  </div>`;
}

export function buildTractPopupHTML(p: TractPopupProps): string {
  const sviPct = p.svi_pct != null ? Math.round(p.svi_pct * 100) : null;
  const combined = p.combined_pct ?? sviPct ?? (p.nri_score != null ? Math.round(p.nri_score) : null);
  const heroColor =
    combined != null
      ? combined >= 80
        ? bandForPct(combined)
        : combined >= 60
        ? bandForPct(combined)
        : bandForPct(combined)
      : "#6b7280";

  const hazards: { label: string; val: number | null }[] = [
    { label: "Hurricane", val: p.nri_hrcn },
    { label: "Coastal flood", val: p.nri_cfld },
    { label: "Riverine flood", val: p.nri_ifld },
    { label: "Tornado", val: p.nri_trnd },
    { label: "Wildfire", val: p.nri_wfir },
    { label: "Heat wave", val: p.nri_hwav },
  ];
  const topHazards = hazards
    .filter((h) => h.val != null && (h.val as number) > 0)
    .sort((a, b) => (b.val as number) - (a.val as number))
    .slice(0, 4);

  return `<div class="tp">
  <div class="tp-hero" style="background:linear-gradient(135deg, ${heroColor} 0%, #5b2b8c 120%)">
    <div>
      <div class="tp-hero-place">${escape(p.place || "Pinellas County")}</div>
      <div class="tp-hero-tract">Tract ${escape(p.name)} · GEOID ${escape(p.geoid)}</div>
    </div>
    <div class="tp-hero-score">
      <div class="tp-hero-score-val">${combined != null ? combined : "—"}</div>
      <div class="tp-hero-score-lbl">Combined</div>
    </div>
  </div>

  <div class="tp-subhead">Population</div>
  <div class="tp-kv"><span class="tp-kv-key">Total</span><span class="tp-kv-val">${fmtInt(p.pop)}</span></div>
  <div class="tp-kv"><span class="tp-kv-key">SVI percentile</span><span class="tp-kv-val">${sviPct != null ? `${sviPct}%` : "—"}</span></div>
  <div class="tp-kv"><span class="tp-kv-key">NRI risk score</span><span class="tp-kv-val">${p.nri_score != null ? p.nri_score.toFixed(1) : "—"}</span></div>

  <div class="tp-subhead">SVI sub-themes</div>
  ${pctBar("Socioeconomic", p.svi_theme1, "#a51c30")}
  ${pctBar("Household comp.", p.svi_theme2, "#a51c30")}
  ${pctBar("Minority status", p.svi_theme3, "#a51c30")}
  ${pctBar("Housing / transport", p.svi_theme4, "#a51c30")}

  ${topHazards.length > 0 ? `<div class="tp-subhead">Top hazards (NRI)</div>${topHazards.map((h) => scoreBar(h.label, h.val)).join("")}` : ""}

  <div class="tp-caption">CDC SVI 2022 · FEMA NRI 2023</div>
</div>`;
}
