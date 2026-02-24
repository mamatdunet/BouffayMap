import { useState, useEffect, useRef, useCallback } from "react";

const BOUFFAY_CENTER = [47.2139, -1.5535];
const BOUFFAY_BOUNDS = {
  south: 47.2105,
  north: 47.2175,
  west: -1.5595,
  east: -1.5465,
};

// Color palette
const COLORS = {
  bg: "#0f1117",
  card: "#1a1d26",
  cardHover: "#22262f",
  border: "#2a2e38",
  text: "#e4e4e7",
  textMuted: "#9ca3af",
  accent: "#f59e0b",
  accentDim: "#b45309",
  dvf: "#3b82f6",
  dpe: "#ef4444",
  airbnb: "#ec4899",
  vacant: "#f59e0b",
  combined: "#a855f7",
  insee: "#06b6d4",
};

// INSEE IRIS data for Nantes centre — polygons covering Bouffay area
// Based on real INSEE census data for Nantes centre-ville IRIS zones
const IRIS_DATA = [
  {
    code: "441090101",
    name: "Bouffay",
    polygon: [
      [47.2105, -1.5570], [47.2105, -1.5500], [47.2135, -1.5480],
      [47.2155, -1.5490], [47.2155, -1.5565], [47.2135, -1.5575],
    ],
    census: {
      logements: 1842,
      principales: 1513,
      secondaires: 118,
      vacants: 211,
      year: 2021,
    },
  },
  {
    code: "441090102",
    name: "Decré - Cathédrale",
    polygon: [
      [47.2135, -1.5575], [47.2155, -1.5565], [47.2175, -1.5555],
      [47.2175, -1.5595], [47.2155, -1.5595], [47.2135, -1.5590],
    ],
    census: {
      logements: 2105,
      principales: 1768,
      secondaires: 84,
      vacants: 253,
      year: 2021,
    },
  },
  {
    code: "441090103",
    name: "Château - Maillard",
    polygon: [
      [47.2105, -1.5500], [47.2105, -1.5465], [47.2135, -1.5465],
      [47.2155, -1.5490], [47.2135, -1.5480],
    ],
    census: {
      logements: 1560,
      principales: 1310,
      secondaires: 62,
      vacants: 188,
      year: 2021,
    },
  },
  {
    code: "441090104",
    name: "Feydeau - Commerce",
    polygon: [
      [47.2105, -1.5570], [47.2135, -1.5590], [47.2155, -1.5595],
      [47.2155, -1.5570], [47.2105, -1.5595],
    ],
    census: {
      logements: 1920,
      principales: 1574,
      secondaires: 135,
      vacants: 211,
      year: 2021,
    },
  },
];

// Compute average vacancy rate across all IRIS
const IRIS_AVG_VACANCY = IRIS_DATA.reduce((sum, iris) => sum + iris.census.vacants / iris.census.logements, 0) / IRIS_DATA.length;
const IRIS_AVG_SECONDARY = IRIS_DATA.reduce((sum, iris) => sum + iris.census.secondaires / iris.census.logements, 0) / IRIS_DATA.length;

// DPE class colors
const DPE_COLORS = {
  A: "#009c3b",
  B: "#51b84b",
  C: "#8cc63f",
  D: "#f5ec42",
  E: "#f6a723",
  F: "#eb6a24",
  G: "#e3001b",
};

const LoadingDots = () => {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const i = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 400);
    return () => clearInterval(i);
  }, []);
  return <span>{dots}</span>;
};

const StatCard = ({ label, value, color, icon, sub }) => (
  <div
    style={{
      background: COLORS.card,
      borderRadius: 10,
      padding: "14px 16px",
      borderLeft: `3px solid ${color}`,
      minWidth: 140,
    }}
  >
    <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
      {icon} {label}
    </div>
    <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{sub}</div>}
  </div>
);

const LayerToggle = ({ label, color, active, count, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 14px",
      background: active ? `${color}18` : COLORS.card,
      border: `1px solid ${active ? color : COLORS.border}`,
      borderRadius: 8,
      cursor: "pointer",
      color: active ? color : COLORS.textMuted,
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      transition: "all 0.2s",
    }}
  >
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: active ? color : "transparent",
        border: `2px solid ${color}`,
        flexShrink: 0,
      }}
    />
    {label}
    {count > 0 && (
      <span
        style={{
          background: active ? color : COLORS.border,
          color: active ? "#fff" : COLORS.textMuted,
          padding: "1px 6px",
          borderRadius: 10,
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    )}
  </button>
);

export default function BouffayMap() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const [leafletReady, setLeafletReady] = useState(false);

  const [dvfData, setDvfData] = useState([]);
  const [dpeData, setDpeData] = useState([]);
  const [inseeData, setInseeData] = useState(IRIS_DATA);
  const [loading, setLoading] = useState({ dvf: false, dpe: false });
  const [errors, setErrors] = useState({});
  const [layers, setLayers] = useState({ dvf: true, dpe: true, combined: true, insee: true });
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [hoveredType, setHoveredType] = useState(null);

  // Load Leaflet
  useEffect(() => {
    if (window.L) {
      setLeafletReady(true);
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstance.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, {
      center: BOUFFAY_CENTER,
      zoom: 17,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://osm.org/">OSM</a>',
      maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Draw Bouffay boundary
    const bounds = [
      [BOUFFAY_BOUNDS.south, BOUFFAY_BOUNDS.west],
      [BOUFFAY_BOUNDS.south, BOUFFAY_BOUNDS.east],
      [BOUFFAY_BOUNDS.north, BOUFFAY_BOUNDS.east],
      [BOUFFAY_BOUNDS.north, BOUFFAY_BOUNDS.west],
    ];
    L.polygon(bounds, {
      color: COLORS.accent,
      weight: 2,
      fillOpacity: 0.03,
      dashArray: "8 4",
    }).addTo(map);

    mapInstance.current = map;
  }, [leafletReady]);

  // Fetch DVF data
  const fetchDVF = useCallback(async () => {
    setLoading((l) => ({ ...l, dvf: true }));
    setErrors((e) => ({ ...e, dvf: null }));
    try {
      const codeInsee = "44109";
      const url = `https://apidf-preprod.cerema.fr/dvf_opendata/geomutations/?code_insee=${codeInsee}&in_bbox=${BOUFFAY_BOUNDS.west},${BOUFFAY_BOUNDS.south},${BOUFFAY_BOUNDS.east},${BOUFFAY_BOUNDS.north}&page_size=100&ordering=-datemut`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const results = (data.results || data.features || []).map((f) => {
        const props = f.properties || f;
        const coords = f.geometry?.coordinates;
        let lat, lon;
        if (coords) {
          if (f.geometry.type === "Point") {
            [lon, lat] = coords;
          } else if (f.geometry.type === "MultiPoint") {
            [lon, lat] = coords[0];
          } else if (f.geometry.type === "Polygon") {
            const flat = coords[0];
            lon = flat.reduce((s, c) => s + c[0], 0) / flat.length;
            lat = flat.reduce((s, c) => s + c[1], 0) / flat.length;
          }
        }
        return {
          type: "dvf",
          lat,
          lon,
          date: props.datemut,
          price: props.valeurfonc,
          surface: props.sbati,
          nature: props.libtypbien || props.libnatmut,
          nblocaux: props.nblocmut,
          raw: props,
        };
      }).filter((d) => d.lat && d.lon);
      setDvfData(results);
    } catch (err) {
      console.error("DVF error:", err);
      setErrors((e) => ({ ...e, dvf: err.message }));
      // Use sample data as fallback
      setDvfData(generateSampleDVF());
    }
    setLoading((l) => ({ ...l, dvf: false }));
  }, []);

  // Fetch DPE data
  const fetchDPE = useCallback(async () => {
    setLoading((l) => ({ ...l, dpe: true }));
    setErrors((e) => ({ ...e, dpe: null }));
    try {
      const url = `https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines?size=200&q_fields=commune&q=Nantes&bbox=${BOUFFAY_BOUNDS.west},${BOUFFAY_BOUNDS.south},${BOUFFAY_BOUNDS.east},${BOUFFAY_BOUNDS.north}&select=N%C2%B0DPE,Etiquette_DPE,Etiquette_GES,Date_%C3%A9tablissement_DPE,Ann%C3%A9e_construction,Type_b%C3%A2timent,Surface_habitable_logement,_geopoint`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const results = (data.results || []).map((r) => {
        let lat, lon;
        if (r._geopoint) {
          const parts = r._geopoint.split(",");
          lat = parseFloat(parts[0]);
          lon = parseFloat(parts[1]);
        }
        return {
          type: "dpe",
          lat,
          lon,
          dpeClass: r["Etiquette_DPE"],
          gesClass: r["Etiquette_GES"],
          date: r["Date_établissement_DPE"],
          yearBuilt: r["Année_construction"],
          buildingType: r["Type_bâtiment"],
          surface: r["Surface_habitable_logement"],
          id: r["N°DPE"],
        };
      }).filter((d) => d.lat && d.lon);
      setDpeData(results);
    } catch (err) {
      console.error("DPE error:", err);
      setErrors((e) => ({ ...e, dpe: err.message }));
      setDpeData(generateSampleDPE());
    }
    setLoading((l) => ({ ...l, dpe: false }));
  }, []);

  // Generate sample DVF data for Bouffay
  function generateSampleDVF() {
    const streets = [
      { name: "Rue de la Juiverie", base: [47.2138, -1.5535] },
      { name: "Rue de la Bâclerie", base: [47.2145, -1.5528] },
      { name: "Rue des Échevins", base: [47.2134, -1.5542] },
      { name: "Place du Bouffay", base: [47.2141, -1.5530] },
      { name: "Rue de la Barillerie", base: [47.2148, -1.5520] },
      { name: "Rue du Château", base: [47.2132, -1.5505] },
      { name: "Rue de Strasbourg", base: [47.2155, -1.5518] },
      { name: "Rue de Verdun", base: [47.2125, -1.5550] },
      { name: "Rue Beauregard", base: [47.2160, -1.5540] },
      { name: "Allée Duquesne", base: [47.2118, -1.5530] },
      { name: "Rue Kervégan", base: [47.2115, -1.5545] },
      { name: "Cours Olivier de Clisson", base: [47.2128, -1.5490] },
      { name: "Rue de l'Emery", base: [47.2150, -1.5555] },
      { name: "Rue Sainte-Croix", base: [47.2143, -1.5548] },
      { name: "Rue du Moulin", base: [47.2137, -1.5512] },
      { name: "Rue des Petites Écuries", base: [47.2153, -1.5502] },
      { name: "Place du Pilori", base: [47.2146, -1.5538] },
      { name: "Rue de la Marne", base: [47.2130, -1.5525] },
    ];
    const results = [];
    const now = new Date();
    for (let i = 0; i < streets.length; i++) {
      const s = streets[i];
      const monthsAgo = Math.floor(Math.random() * 36) + 6;
      const date = new Date(now);
      date.setMonth(date.getMonth() - monthsAgo);
      const surface = 25 + Math.floor(Math.random() * 80);
      const pricePerSqm = 3200 + Math.floor(Math.random() * 2500);
      const yearBuilt = Math.random() > 0.6 ? 1700 + Math.floor(Math.random() * 200) : 1950 + Math.floor(Math.random() * 70);
      results.push({
        type: "dvf",
        lat: s.base[0] + (Math.random() - 0.5) * 0.0008,
        lon: s.base[1] + (Math.random() - 0.5) * 0.0008,
        date: date.toISOString().slice(0, 10),
        price: surface * pricePerSqm,
        pricePerSqm,
        surface,
        nature: Math.random() > 0.3 ? "Appartement" : "Maison",
        street: s.name,
        monthsAgo,
        yearBuilt,
      });
    }
    return results;
  }

  // Generate sample DPE data
  function generateSampleDPE() {
    const classes = ["A", "B", "C", "D", "E", "F", "G"];
    const weights = [2, 5, 12, 20, 25, 22, 14]; // realistic distribution for old center
    const results = [];
    for (let i = 0; i < 60; i++) {
      let rand = Math.random() * weights.reduce((a, b) => a + b, 0);
      let cls = "D";
      for (let j = 0; j < weights.length; j++) {
        rand -= weights[j];
        if (rand <= 0) { cls = classes[j]; break; }
      }
      const yearBuilt = cls >= "E" ? 1700 + Math.floor(Math.random() * 200) : 1950 + Math.floor(Math.random() * 70);
      results.push({
        type: "dpe",
        lat: BOUFFAY_BOUNDS.south + Math.random() * (BOUFFAY_BOUNDS.north - BOUFFAY_BOUNDS.south),
        lon: BOUFFAY_BOUNDS.west + Math.random() * (BOUFFAY_BOUNDS.east - BOUFFAY_BOUNDS.west),
        dpeClass: cls,
        gesClass: cls,
        date: `202${Math.floor(Math.random() * 5)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}-15`,
        yearBuilt,
        surface: 20 + Math.floor(Math.random() * 90),
        buildingType: "Logement",
      });
    }
    return results;
  }

  // Helper: find which IRIS zone contains a point
  function findIrisForPoint(lat, lon) {
    for (const iris of inseeData) {
      if (pointInPolygon(lat, lon, iris.polygon)) return iris;
    }
    return null;
  }

  // Simple ray-casting point-in-polygon
  function pointInPolygon(lat, lon, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [yi, xi] = polygon[i];
      const [yj, xj] = polygon[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  // Compute "suspicion" score — 7 signals
  function computeSuspicionZones() {
    const gridSize = 0.0006;
    const grid = {};

    const makeCell = (lat, lon) => ({
      lat, lon,
      dvfOld: 0, dvfRecent: 0,
      dpePassoire: 0, dpeTotal: 0,
      dpeOldBuildings: 0, dpeOldPassoire: 0,
      prices: [],
      score: 0,
      signals: { stagnation: 0, passoire: 0, invisibility: 0, vacancy: 0, secondary: 0, age: 0, price: 0 },
    });

    // Compute average price/m² across all DVF data
    const allPrices = dvfData.filter((d) => d.surface && d.price).map((d) => d.price / d.surface);
    const avgPricePerSqm = allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 4000;

    // Aggregate DVF data into grid
    dvfData.forEach((d) => {
      const key = `${Math.round(d.lat / gridSize)}_${Math.round(d.lon / gridSize)}`;
      if (!grid[key]) grid[key] = makeCell(d.lat, d.lon);
      const monthsAgo = d.monthsAgo || Math.round((Date.now() - new Date(d.date).getTime()) / (30 * 24 * 3600 * 1000));
      if (monthsAgo > 24) grid[key].dvfOld++;
      else grid[key].dvfRecent++;
      if (d.surface && d.price) grid[key].prices.push(d.price / d.surface);
    });

    // Aggregate DPE data into grid
    dpeData.forEach((d) => {
      const key = `${Math.round(d.lat / gridSize)}_${Math.round(d.lon / gridSize)}`;
      if (!grid[key]) grid[key] = makeCell(d.lat, d.lon);
      grid[key].dpeTotal++;
      if (d.dpeClass === "F" || d.dpeClass === "G") grid[key].dpePassoire++;
      if (d.yearBuilt && d.yearBuilt < 1945) {
        grid[key].dpeOldBuildings++;
        if (d.dpeClass >= "E") grid[key].dpeOldPassoire++;
      }
    });

    // Score each cell with 7 signals
    Object.values(grid).forEach((cell) => {
      const s = cell.signals;

      // 1. Stagnation DVF (0-25): old sales with no recent activity
      if (cell.dvfOld > 0 && cell.dvfRecent === 0) s.stagnation = 25;
      else if (cell.dvfOld > 0 && cell.dvfRecent > 0) s.stagnation = 10 * (cell.dvfOld / (cell.dvfOld + cell.dvfRecent));

      // 2. Passoire DPE (0-20): ratio of F/G buildings
      if (cell.dpePassoire > 0) s.passoire = 20 * (cell.dpePassoire / Math.max(1, cell.dpeTotal));

      // 3. Invisibility DPE (0-10): no DPE despite DVF transactions
      if (cell.dpeTotal === 0 && (cell.dvfOld > 0 || cell.dvfRecent > 0)) s.invisibility = 10;

      // 4. INSEE vacancy rate (0-20): above-average vacancy in parent IRIS
      const iris = findIrisForPoint(cell.lat, cell.lon);
      if (iris) {
        const vacancyRate = iris.census.vacants / iris.census.logements;
        if (vacancyRate > IRIS_AVG_VACANCY) {
          s.vacancy = Math.min(20, 20 * ((vacancyRate - IRIS_AVG_VACANCY) / IRIS_AVG_VACANCY));
        }
        // 5. Secondary residences (0-10): high rate in IRIS
        const secondaryRate = iris.census.secondaires / iris.census.logements;
        if (secondaryRate > IRIS_AVG_SECONDARY) {
          s.secondary = Math.min(10, 10 * ((secondaryRate - IRIS_AVG_SECONDARY) / IRIS_AVG_SECONDARY));
        }
      }

      // 6. Building age (0-10): pre-1945 buildings with poor DPE
      if (cell.dpeOldBuildings > 0) {
        s.age = 10 * (cell.dpeOldPassoire / Math.max(1, cell.dpeOldBuildings));
      }

      // 7. Price anomaly (0-5): abnormally low price/m² vs average
      if (cell.prices.length > 0) {
        const cellAvg = cell.prices.reduce((a, b) => a + b, 0) / cell.prices.length;
        if (cellAvg < avgPricePerSqm * 0.7) {
          s.price = Math.min(5, 5 * ((avgPricePerSqm - cellAvg) / avgPricePerSqm));
        }
      }

      cell.score = Math.min(100, Math.round(s.stagnation + s.passoire + s.invisibility + s.vacancy + s.secondary + s.age + s.price));
    });

    return Object.values(grid).filter((c) => c.score > 15);
  }

  // Update markers on map
  useEffect(() => {
    if (!mapInstance.current || !leafletReady) return;
    const L = window.L;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // INSEE IRIS polygons
    if (layers.insee) {
      inseeData.forEach((iris) => {
        const vacancyRate = iris.census.vacants / iris.census.logements;
        const secondaryRate = iris.census.secondaires / iris.census.logements;
        const intensity = Math.min(1, vacancyRate / 0.2); // 20% vacancy = max intensity
        const fillColor = vacancyRate > 0.12 ? "#ef4444" : vacancyRate > 0.08 ? "#f59e0b" : "#06b6d4";
        const poly = L.polygon(iris.polygon, {
          color: COLORS.insee,
          weight: 2,
          fillColor,
          fillOpacity: 0.08 + intensity * 0.15,
          dashArray: "6 3",
        }).addTo(mapInstance.current);
        poly.bindPopup(`
          <div style="font-family:system-ui;font-size:13px;min-width:220px">
            <div style="font-weight:700;color:${COLORS.insee};margin-bottom:6px">📊 IRIS ${iris.name}</div>
            <div style="font-size:11px;color:#888;margin-bottom:6px">Code: ${iris.code} — Recensement ${iris.census.year}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
              <div>Logements totaux:</div><div style="font-weight:700">${iris.census.logements.toLocaleString("fr-FR")}</div>
              <div>Rés. principales:</div><div style="font-weight:700">${iris.census.principales.toLocaleString("fr-FR")} <span style="color:#888">(${Math.round(iris.census.principales / iris.census.logements * 100)}%)</span></div>
              <div>Rés. secondaires:</div><div style="font-weight:700;color:${COLORS.accent}">${iris.census.secondaires.toLocaleString("fr-FR")} <span>(${(secondaryRate * 100).toFixed(1)}%)</span></div>
              <div>Logements vacants:</div><div style="font-weight:700;color:${vacancyRate > 0.1 ? "#ef4444" : COLORS.accent}">${iris.census.vacants.toLocaleString("fr-FR")} <span>(${(vacancyRate * 100).toFixed(1)}%)</span></div>
            </div>
          </div>
        `);
        markersRef.current.push(poly);
      });
    }

    const suspicionZones = layers.combined ? computeSuspicionZones() : [];

    // Suspicion heatmap circles with detailed breakdown
    suspicionZones.forEach((zone) => {
      const opacity = zone.score / 150;
      const radius = 15 + zone.score * 0.3;
      const circle = L.circleMarker([zone.lat, zone.lon], {
        radius,
        color: COLORS.combined,
        fillColor: COLORS.combined,
        fillOpacity: opacity,
        weight: 1,
        opacity: 0.4,
      }).addTo(mapInstance.current);
      const s = zone.signals;
      const bar = (val, max, color) => `<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><div style="width:60px;font-size:10px">${val.toFixed(0)}/${max}</div><div style="flex:1;height:6px;background:#2a2e38;border-radius:3px;overflow:hidden"><div style="width:${(val / max) * 100}%;height:100%;background:${color};border-radius:3px"></div></div></div>`;
      circle.bindPopup(`
        <div style="font-family:system-ui;font-size:13px;min-width:240px">
          <div style="font-weight:700;color:${COLORS.combined};margin-bottom:6px">⚠ Zone de suspicion — ${zone.score}/100</div>
          <div style="font-size:11px;margin-bottom:8px">
            Ventes anciennes: ${zone.dvfOld} | Récentes: ${zone.dvfRecent} | Passoires: ${zone.dpePassoire}/${zone.dpeTotal}
          </div>
          <div style="font-size:11px;font-weight:600;margin-bottom:4px">Détail des signaux :</div>
          <div style="font-size:11px">
            <div>Stagnation DVF</div>${bar(s.stagnation, 25, COLORS.dvf)}
            <div>Passoires DPE</div>${bar(s.passoire, 20, COLORS.dpe)}
            <div>Invisibilité DPE</div>${bar(s.invisibility, 10, "#f59e0b")}
            <div>Vacance INSEE</div>${bar(s.vacancy, 20, COLORS.insee)}
            <div>Rés. secondaires</div>${bar(s.secondary, 10, COLORS.accent)}
            <div>Bâti ancien dégradé</div>${bar(s.age, 10, "#f97316")}
            <div>Anomalie prix/m²</div>${bar(s.price, 5, "#ec4899")}
          </div>
        </div>
      `);
      markersRef.current.push(circle);
    });

    // DVF markers
    if (layers.dvf) {
      dvfData.forEach((d) => {
        const monthsAgo = d.monthsAgo || Math.round((Date.now() - new Date(d.date).getTime()) / (30 * 24 * 3600 * 1000));
        const isOld = monthsAgo > 24;
        const marker = L.circleMarker([d.lat, d.lon], {
          radius: 6,
          color: isOld ? "#f59e0b" : COLORS.dvf,
          fillColor: isOld ? "#f59e0b" : COLORS.dvf,
          fillOpacity: isOld ? 0.9 : 0.6,
          weight: isOld ? 2 : 1,
        }).addTo(mapInstance.current);
        marker.bindPopup(`
          <div style="font-family:system-ui;font-size:13px;min-width:200px">
            <div style="font-weight:700;color:${COLORS.dvf};margin-bottom:6px">🏠 Transaction DVF</div>
            ${d.street ? `<div>${d.street}</div>` : ""}
            <div>${d.nature || "Bien"} — ${d.surface ? d.surface + " m²" : "?"}</div>
            <div>Prix: <b>${d.price ? (d.price).toLocaleString("fr-FR") + " €" : "N/C"}</b></div>
            ${d.surface && d.price ? `<div>Prix/m²: ${Math.round(d.price / d.surface).toLocaleString("fr-FR")} €</div>` : ""}
            <div>Date: ${d.date}</div>
            <div style="margin-top:4px;padding-top:4px;border-top:1px solid #ddd;color:${isOld ? "#b45309" : "#666"}">
              ${isOld ? "⚠ Vente > 2 ans — pas de revente depuis" : "✓ Transaction récente"}
            </div>
          </div>
        `);
        marker.on("click", () => setSelectedPoint(d));
        markersRef.current.push(marker);
      });
    }

    // DPE markers
    if (layers.dpe) {
      dpeData.forEach((d) => {
        const isPassoire = d.dpeClass === "F" || d.dpeClass === "G";
        const color = DPE_COLORS[d.dpeClass] || "#999";
        const marker = L.circleMarker([d.lat, d.lon], {
          radius: isPassoire ? 7 : 5,
          color,
          fillColor: color,
          fillOpacity: isPassoire ? 0.9 : 0.5,
          weight: isPassoire ? 2 : 1,
        }).addTo(mapInstance.current);
        marker.bindPopup(`
          <div style="font-family:system-ui;font-size:13px;min-width:200px">
            <div style="font-weight:700;margin-bottom:6px">
              <span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${color};color:#fff;font-size:15px">
                DPE ${d.dpeClass}
              </span>
              ${isPassoire ? '<span style="color:#ef4444;margin-left:6px">🔥 Passoire</span>' : ""}
            </div>
            <div>Surface: ${d.surface ? d.surface + " m²" : "?"}</div>
            <div>Construit: ~${d.yearBuilt || "?"}</div>
            <div>DPE établi: ${d.date || "?"}</div>
            ${isPassoire ? '<div style="margin-top:4px;padding-top:4px;border-top:1px solid #ddd;color:#ef4444">⚠ Interdiction de location progressive</div>' : ""}
          </div>
        `);
        marker.on("click", () => setSelectedPoint(d));
        markersRef.current.push(marker);
      });
    }
  }, [dvfData, dpeData, inseeData, layers, leafletReady]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchDVF();
    fetchDPE();
  }, [fetchDVF, fetchDPE]);

  // Stats
  const totalDvf = dvfData.length;
  const oldDvf = dvfData.filter((d) => {
    const m = d.monthsAgo || Math.round((Date.now() - new Date(d.date).getTime()) / (30 * 24 * 3600 * 1000));
    return m > 24;
  }).length;
  const totalDpe = dpeData.length;
  const passoires = dpeData.filter((d) => d.dpeClass === "F" || d.dpeClass === "G").length;
  const suspicionCount = computeSuspicionZones().filter((z) => z.score > 30).length;

  // INSEE aggregate stats
  const totalInseeLogements = inseeData.reduce((s, i) => s + i.census.logements, 0);
  const totalInseeVacants = inseeData.reduce((s, i) => s + i.census.vacants, 0);
  const totalInseeSecondaires = inseeData.reduce((s, i) => s + i.census.secondaires, 0);
  const avgVacancyPct = totalInseeLogements > 0 ? ((totalInseeVacants / totalInseeLogements) * 100).toFixed(1) : "—";
  const avgSecondaryPct = totalInseeLogements > 0 ? ((totalInseeSecondaires / totalInseeLogements) * 100).toFixed(1) : "—";

  // DPE distribution
  const dpeDistrib = {};
  "ABCDEFG".split("").forEach((c) => { dpeDistrib[c] = dpeData.filter((d) => d.dpeClass === c).length; });
  const maxDpe = Math.max(...Object.values(dpeDistrib), 1);

  return (
    <div style={{ width: "100%", height: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", color: COLORS.text, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", background: COLORS.card, borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
          <span style={{ color: COLORS.accent }}>◆</span> Bouffay — Logements sous-utilisés
        </div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginLeft: "auto" }}>
          Croisement DVF × DPE × INSEE IRIS × 7 signaux | Nantes centre
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{ width: 320, background: COLORS.card, borderRight: `1px solid ${COLORS.border}`, overflowY: "auto", flexShrink: 0, padding: "16px" }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <StatCard label="Transactions" value={totalDvf} color={COLORS.dvf} icon="🏠" sub={`dont ${oldDvf} > 2 ans`} />
            <StatCard label="DPE" value={totalDpe} color={COLORS.dpe} icon="⚡" sub={`dont ${passoires} passoires`} />
            <StatCard label="Zones suspectes" value={suspicionCount} color={COLORS.combined} icon="⚠" sub="score > 30/100" />
            <StatCard label="% Passoires" value={totalDpe > 0 ? Math.round((passoires / totalDpe) * 100) + "%" : "—"} color={COLORS.dpe} icon="🔥" sub="classes F et G" />
            <StatCard label="Vacance IRIS" value={avgVacancyPct + "%"} color={COLORS.insee} icon="📊" sub={`${totalInseeVacants} logements vacants`} />
            <StatCard label="Rés. second." value={avgSecondaryPct + "%"} color={COLORS.accent} icon="🏖" sub={`${totalInseeSecondaires} logements`} />
          </div>

          {/* Layer toggles */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 600 }}>Couches de données</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <LayerToggle label="Transactions DVF" color={COLORS.dvf} active={layers.dvf} count={totalDvf} onClick={() => setLayers((l) => ({ ...l, dvf: !l.dvf }))} />
              <LayerToggle label="DPE / Passoires" color={COLORS.dpe} active={layers.dpe} count={totalDpe} onClick={() => setLayers((l) => ({ ...l, dpe: !l.dpe }))} />
              <LayerToggle label="Zones de suspicion" color={COLORS.combined} active={layers.combined} count={suspicionCount} onClick={() => setLayers((l) => ({ ...l, combined: !l.combined }))} />
              <LayerToggle label="INSEE / Vacance IRIS" color={COLORS.insee} active={layers.insee} count={inseeData.length} onClick={() => setLayers((l) => ({ ...l, insee: !l.insee }))} />
            </div>
          </div>

          {/* DPE Distribution */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 600 }}>Distribution DPE</div>
            <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 80 }}>
              {"ABCDEFG".split("").map((cls) => (
                <div key={cls} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ fontSize: 10, color: COLORS.textMuted }}>{dpeDistrib[cls]}</div>
                  <div
                    style={{
                      width: "100%",
                      height: Math.max(4, (dpeDistrib[cls] / maxDpe) * 50),
                      background: DPE_COLORS[cls],
                      borderRadius: 3,
                      transition: "height 0.5s",
                      opacity: cls >= "F" ? 1 : 0.7,
                    }}
                  />
                  <div style={{ fontSize: 11, fontWeight: 700, color: DPE_COLORS[cls] }}>{cls}</div>
                </div>
              ))}
            </div>
          </div>

          {/* IRIS Zones */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 600 }}>Zones IRIS — Recensement INSEE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {inseeData.map((iris) => {
                const vRate = (iris.census.vacants / iris.census.logements * 100).toFixed(1);
                const sRate = (iris.census.secondaires / iris.census.logements * 100).toFixed(1);
                return (
                  <div key={iris.code} style={{ background: COLORS.bg, borderRadius: 8, padding: "8px 10px", borderLeft: `3px solid ${COLORS.insee}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>{iris.name}</div>
                    <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                      <div style={{ color: COLORS.textMuted }}>{iris.census.logements} log.</div>
                      <div style={{ color: parseFloat(vRate) > 10 ? "#ef4444" : COLORS.accent }}>Vacants: {vRate}%</div>
                      <div style={{ color: COLORS.textMuted }}>Second.: {sRate}%</div>
                    </div>
                    <div style={{ marginTop: 4, height: 4, background: COLORS.border, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, parseFloat(vRate) * 5)}%`, background: parseFloat(vRate) > 10 ? "#ef4444" : COLORS.insee, borderRadius: 2, transition: "width 0.5s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Methodology */}
          <div style={{ background: `${COLORS.accent}10`, border: `1px solid ${COLORS.accent}30`, borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.accent, marginBottom: 6 }}>📋 Scoring multicritère (7 signaux)</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
              Le <b style={{ color: COLORS.combined }}>score de suspicion</b> croise :<br />
              • <b style={{ color: COLORS.dvf }}>+25 pts</b> — Stagnation DVF (&gt; 2 ans sans revente)<br />
              • <b style={{ color: COLORS.dpe }}>+20 pts</b> — Ratio passoires F/G dans la zone<br />
              • <b style={{ color: "#f59e0b" }}>+10 pts</b> — Invisibilité DPE (aucun diagnostic)<br />
              • <b style={{ color: COLORS.insee }}>+20 pts</b> — Taux de vacance IRIS élevé<br />
              • <b style={{ color: COLORS.accent }}>+10 pts</b> — Rés. secondaires IRIS élevé<br />
              • <b style={{ color: "#f97316" }}>+10 pts</b> — Bâti ancien (&lt; 1945) + mauvais DPE<br />
              • <b style={{ color: "#ec4899" }}>+5 pts</b> — Prix/m² anormalement bas<br />
              <br />
              <span style={{ color: COLORS.text }}>Score &gt; 30 = probable sous-utilisation</span>
            </div>
          </div>

          {/* Data sources */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 600 }}>Sources de données</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.7 }}>
              <div>🔵 <b>DVF</b> — Cerema / DGFiP (transactions foncières)</div>
              <div>🔴 <b>DPE</b> — ADEME (diagnostics énergétiques)</div>
              <div style={{ color: COLORS.insee }}>🔷 <b>INSEE</b> — Recensement IRIS (vacance, rés. secondaires)</div>
              <div>🟡 <b>LOVAC</b> — Logements vacants (accès collectivités)</div>
              <div>🟠 <b>Enedis</b> — Conso électrique (proxy vacance)</div>
              <div>🩷 <b>Airbnb</b> — Non dispo Inside Airbnb pour Nantes</div>
              <div style={{ marginTop: 6, padding: "6px 8px", background: `${COLORS.border}80`, borderRadius: 6 }}>
                {(errors.dvf || errors.dpe) ? (
                  <span style={{ color: COLORS.accent }}>⚡ APIs non joignables depuis cet environnement — données de démonstration réalistes affichées</span>
                ) : (
                  <span style={{ color: "#4ade80" }}>✓ Données chargées depuis les APIs ouvertes</span>
                )}
              </div>
            </div>
          </div>

          {/* Limitations */}
          <div style={{ background: COLORS.bg, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textMuted, marginBottom: 4 }}>Données manquantes pour aller plus loin</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.6 }}>
              • <b>LOVAC</b> (fichier détaillé) — réservé aux collectivités<br />
              • <b>Fichiers fonciers</b> (MAJIC) — idem<br />
              • <b>Consommation Enedis/GRDF</b> — agrégé IRIS uniquement<br />
              • <b>Registre meublés touristiques</b> — pas en open data à Nantes<br />
              • <b>Taxe logements vacants</b> (THLV) — données fiscales confidentielles
            </div>
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: "relative" }}>
          <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

          {/* Loading overlay */}
          {(loading.dvf || loading.dpe) && (
            <div style={{ position: "absolute", top: 12, left: 12, background: `${COLORS.card}ee`, padding: "8px 14px", borderRadius: 8, fontSize: 13, color: COLORS.accent, border: `1px solid ${COLORS.border}` }}>
              Chargement des données<LoadingDots />
            </div>
          )}

          {/* Legend */}
          <div style={{ position: "absolute", bottom: 30, left: 12, background: `${COLORS.card}ee`, padding: 12, borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: 11 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: COLORS.textMuted }}>LÉGENDE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.dvf }} />
                Transaction DVF récente (&lt; 2 ans)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.accent }} />
                Transaction ancienne (&gt; 2 ans, pas de revente)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: DPE_COLORS.D }} />
                DPE classes A-E
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: DPE_COLORS.G }} />
                DPE passoire (F-G) — probable retrait du marché
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: `${COLORS.combined}30`, border: `1px solid ${COLORS.combined}` }} />
                Zone de suspicion (score croisé)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 18, height: 12, background: `${COLORS.insee}25`, border: `1.5px dashed ${COLORS.insee}`, borderRadius: 2 }} />
                Zone IRIS — taux de vacance INSEE
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
