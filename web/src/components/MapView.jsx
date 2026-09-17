import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const GEOAPIFY_KEY = 'f2c866843de043509aeb5c918773eb41';

// Helper: format a DB row into the shape the UI expects
function dbRowToHazard(row) {
  const lat  = row.latitude;
  const lng  = row.longitude;
  const conf = typeof row.confidence === 'number' ? row.confidence : parseFloat(row.confidence);
  const acc  = row.gps_accuracy != null ? parseFloat(row.gps_accuracy) : null;
  const ts   = row.timestamp ? new Date(row.timestamp) : new Date();
  const detectedTime = ts.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  return {
    id:           `PTH-${row.id}`,
    dbId:         row.id,
    title:        row.class_name
                    ? `${row.class_name.charAt(0).toUpperCase() + row.class_name.slice(1)} #${row.id}`
                    : `Pothole #${row.id}`,
    lat,
    lng,
    severity:     row.severity || 'moderate',
    detectedTime,
    coordsText:   `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`,
    confidence:   `${conf.toFixed(1)}%`,
    gps_accuracy: acc != null ? `±${acc.toFixed(0)} m` : 'N/A',
    image:        'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=600&auto=format&fit=crop',
  };
}

export default function MapView({ showToast, apiUrl }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef  = useRef(null);
  const markersRef      = useRef([]);

  // Live data from backend
  const [hazardsData, setHazardsData]       = useState([]);
  const [isLoadingData, setIsLoadingData]   = useState(true);

  const [selectedHazard, setSelectedHazard] = useState(null);
  const [isSheetOpen, setIsSheetOpen]       = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [geoResults, setGeoResults]         = useState([]);
  const [isSearching, setIsSearching]       = useState(false);
  const [showDropdown, setShowDropdown]     = useState(false);

  const criticalCount = hazardsData.filter(h => h.severity === 'critical').length;
  const moderateCount = hazardsData.filter(h => h.severity === 'moderate').length;

  // ── Fetch GPS potholes from backend & poll ─────────────────────────────────────
  const fetchPotholes = useCallback(async () => {
    const base = (apiUrl || 'http://localhost:5000').replace(/\/+$/, '');
    try {
      const res  = await fetch(`${base}/api/gps_potholes`, {
        headers: { 'Bypass-Tunnel-Reminder': 'true' },
        signal:  AbortSignal.timeout(5000),
      });
      if (!res.ok) return;
      const rows = await res.json();
      const mapped = rows.map(dbRowToHazard);
      setHazardsData(mapped);

      // Auto-select first hazard if none selected yet
      setSelectedHazard(prev => {
        if (prev) return prev; // keep existing selection
        return mapped.length > 0 ? mapped[0] : null;
      });

      // Auto-center map on first real record (once)
      if (mapped.length > 0 && mapInstanceRef.current) {
        const first = mapped[0];
        mapInstanceRef.current.setView([first.lat, first.lng], 15);
      }
    } catch (_) {
      // Silently ignore network errors — keeps map working when offline
    } finally {
      setIsLoadingData(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchPotholes();
    const interval = setInterval(fetchPotholes, 8000); // poll every 8 seconds
    return () => clearInterval(interval);
  }, [fetchPotholes]);

  // Filtered local hazard matches
  const hazardResults = hazardsData.filter((h) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      h.title.toLowerCase().includes(q) ||
      h.id.toLowerCase().includes(q) ||
      h.severity.toLowerCase().includes(q)
    );
  });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20.5937, 78.9629], // Fixed orientation: Default to India
      zoom: 5,
      zoomControl: false,
    });

    // Add Geoapify Carto Retina Tile Layer
    const streetLayer = L.tileLayer(`https://maps.geoapify.com/v1/tile/carto/{z}/{x}/{y}@2x.png?apiKey=${GEOAPIFY_KEY}`, {
      attribution: 'Powered by <a href="https://www.geoapify.com/" target="_blank">Geoapify</a> | &copy; OpenStreetMap',
      maxZoom: 20,
    });

    // Add Satellite Layer
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri',
      maxZoom: 20,
    });

    satelliteLayer.addTo(map); // Default to satellite view

    // Add Layer Control
    L.control.layers({
      "Satellite View": satelliteLayer,
      "Street View": streetLayer
    }, null, { position: 'bottomleft' }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const activeList = hazardsData.filter((h) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q || h.title.toLowerCase().includes(q) || h.id.toLowerCase().includes(q);
      const matchesSev =
        filterSeverity === 'all' || h.severity === filterSeverity;
      return matchesSearch && matchesSev;
    });

    activeList.forEach((hazard) => {
      const isCritical = hazard.severity === 'critical';
      const isSelected = selectedHazard?.id === hazard.id;

      const markerHtml = `
        <div class="relative flex flex-col items-center cursor-pointer group ${
          isSelected ? 'scale-125 z-30' : 'z-10'
        } transition-transform">
          <div class="absolute -bottom-1 w-6 h-2 rounded-full ${
            isCritical
              ? 'bg-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.8)]'
              : 'bg-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.8)]'
          } blur-[3px]"></div>
          <div class="w-9 h-9 rounded-full ${
            isCritical
              ? 'bg-[#111827] border-2 border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
              : 'bg-[#111827] border-2 border-amber-500 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
          } flex items-center justify-center font-bold">
            <span class="material-symbols-outlined text-base">
              ${isCritical ? 'warning' : 'report'}
            </span>
          </div>
          <div class="w-1 h-3 ${isCritical ? 'bg-red-500' : 'bg-amber-500'} -mt-1"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-leaflet-marker',
        iconSize: [36, 48],
        iconAnchor: [18, 48],
      });

      const marker = L.marker([hazard.lat, hazard.lng], { icon: customIcon }).addTo(map);

      marker.on('click', () => {
        setSelectedHazard(hazard);
        setIsSheetOpen(true);
        map.flyTo([hazard.lat, hazard.lng], 16, { duration: 0.8 });
      });

      markersRef.current.push(marker);
    });
  }, [searchQuery, filterSeverity, selectedHazard]);

  // Geoapify Geocoding API Search
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setGeoResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
            q
          )}&apiKey=${GEOAPIFY_KEY}`
        );
        if (!response.ok) throw new Error('Geocoding error');
        const data = await response.json();
        if (data.features) {
          const results = data.features.slice(0, 4).map((f) => ({
            name: f.properties.formatted,
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
          }));
          setGeoResults(results);
        }
      } catch (err) {
        console.error('Geoapify search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectHazard = (hazard) => {
    setSelectedHazard(hazard);
    setIsSheetOpen(true);
    setShowDropdown(false);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([hazard.lat, hazard.lng], 16, { duration: 1 });
    }
    if (showToast) showToast(`Focused on ${hazard.title}`, 'info');
  };

  const handleSelectGeoPlace = (place) => {
    setShowDropdown(false);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([place.lat, place.lng], 14, { duration: 1 });
    }
    if (showToast) showToast(`Moved map to ${place.name}`, 'info');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (hazardResults.length > 0) {
      handleSelectHazard(hazardResults[0]);
    } else if (geoResults.length > 0) {
      handleSelectGeoPlace(geoResults[0]);
    } else {
      if (showToast) showToast('No matching location found', 'error');
    }
  };

  const handleRecentering = () => {
    if (mapInstanceRef.current) {
      const center = hazardsData.length > 0
        ? [hazardsData[0].lat, hazardsData[0].lng]
        : [20.5937, 78.9629]; // India centre as neutral default
      mapInstanceRef.current.flyTo(center, 14, { duration: 1 });
      if (showToast) showToast('Map recentered', 'info');
    }
  };

  const handleNavigateMap = (hazard) => {
    if (!hazard) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${hazard.lat},${hazard.lng}`;
    window.open(url, '_blank');
    if (showToast) showToast(`Opening directions to ${hazard.title}...`, 'info');
  };

  const handleReportIssue = (hazard) => {
    if (showToast) {
      showToast(`Hazard report dispatched for ${hazard.id}!`, 'success');
    }
  };


  return (
    <main className="flex-1 relative w-full h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-[#0a0e17]">
      {/* Empty-state overlay when no GPS detections yet */}
      {!isLoadingData && hazardsData.length === 0 && (
        <div className="absolute inset-0 z-[600] flex flex-col items-center justify-center gap-4 pointer-events-none">
          <div className="bg-[#111827]/95 backdrop-blur-xl border border-slate-700/60 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-2xl max-w-sm text-center">
            <span className="material-symbols-outlined text-4xl text-amber-400">gps_fixed</span>
            <h3 className="font-heading text-lg font-bold text-slate-100">No GPS Detections Yet</h3>
            <p className="text-xs text-slate-400">
              Go to <span className="text-amber-400 font-semibold">Scan → Live Stream HUD</span>, grant location permission, and point your camera at road hazards. Detections will appear here automatically.
            </p>
          </div>
        </div>
      )}
      {/* Search & HUD Controls Bar */}
      <div className="absolute top-4 left-4 right-4 z-[400] pointer-events-none flex flex-col md:flex-row justify-between items-start gap-3">
        {/* Search Container with Autocomplete Dropdown */}
        <div className="pointer-events-auto relative w-full max-w-md">
          <form
            onSubmit={handleSearchSubmit}
            className="bg-[#111827]/95 backdrop-blur-md border border-slate-700/80 rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-2xl hover:border-amber-500/40 transition-colors"
          >
            <span className="material-symbols-outlined text-slate-400">search</span>
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              placeholder="Search location, street, or hazard ID..."
              className="bg-transparent border-none text-slate-100 placeholder-slate-500 text-sm focus:outline-none w-full"
            />
            {isSearching && (
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setGeoResults([]);
                  setShowDropdown(false);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </form>

          {/* Autocomplete Suggestions Panel */}
          {showDropdown && searchQuery.trim().length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-2 bg-[#111827]/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 max-h-80 overflow-y-auto space-y-1 animate-in fade-in"
              onMouseLeave={() => setShowDropdown(false)}
            >
              {/* Local Hazard Matches Section */}
              {hazardResults.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10px] font-mono text-amber-400 uppercase tracking-wider">
                    Pothole Hazards ({hazardResults.length})
                  </div>
                  {hazardResults.map((hazard) => (
                    <button
                      key={hazard.id}
                      onClick={() => handleSelectHazard(hazard)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800/80 flex items-center justify-between transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span
                          className={`material-symbols-outlined text-base ${
                            hazard.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                          }`}
                        >
                          {hazard.severity === 'critical' ? 'warning' : 'report'}
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-semibold text-slate-100 group-hover:text-amber-400 truncate">
                            {hazard.title}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400">
                            ID: {hazard.id} • {hazard.coordsText}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                          hazard.severity === 'critical'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {hazard.severity}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Global Geoapify Places Section */}
              {geoResults.length > 0 && (
                <div className="pt-1 border-t border-slate-800">
                  <div className="px-3 py-1 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                    Global Locations (Geoapify)
                  </div>
                  {geoResults.map((place, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectGeoPlace(place)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800/80 flex items-center gap-2 text-slate-300 hover:text-cyan-400 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm text-cyan-400">location_on</span>
                      <span className="text-xs truncate">{place.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {hazardResults.length === 0 && geoResults.length === 0 && !isSearching && (
                <div className="p-4 text-center text-xs text-slate-400">
                  No matching hazards or locations found.
                </div>
              )}
            </div>
          )}
        </div>

        {/* HUD Hazard Filter Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="bg-[#111827]/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-1.5 flex items-center gap-1 shadow-2xl">
            <button
              onClick={() => setFilterSeverity('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                filterSeverity === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({hazardsData.length})
            </button>
            <button
              onClick={() => setFilterSeverity('critical')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 ${
                filterSeverity === 'critical'
                  ? 'bg-red-500 text-slate-100 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                  : 'text-slate-400 hover:text-red-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Critical ({criticalCount})
            </button>
            <button
              onClick={() => setFilterSeverity('moderate')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 ${
                filterSeverity === 'moderate'
                  ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Moderate ({moderateCount})
            </button>
          </div>

          <button
            onClick={handleRecentering}
            className="w-10 h-10 bg-[#111827]/90 backdrop-blur-md border border-slate-700/80 rounded-2xl flex items-center justify-center text-slate-300 hover:text-amber-400 hover:border-amber-500/40 shadow-2xl transition-all"
            title="Recenter Map"
          >
            <span className="material-symbols-outlined text-xl">my_location</span>
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[500px] z-10" />

      {/* Details Bottom Sheet */}
      {selectedHazard && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-[500] bg-[#111827]/95 backdrop-blur-xl border-t border-slate-800 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.6)] transition-transform duration-300 ${
            isSheetOpen ? 'translate-y-0' : 'translate-y-[calc(100%-44px)]'
          }`}
        >
          {/* Sheet Handle */}
          <div
            onClick={() => setIsSheetOpen(!isSheetOpen)}
            className="w-full flex flex-col items-center pt-3 pb-2 cursor-pointer group"
          >
            <div className="w-12 h-1.5 bg-slate-700 group-hover:bg-amber-400 rounded-full transition-colors" />
          </div>

          <div className="px-5 pb-6 pt-1 max-w-3xl mx-auto space-y-4">
            {/* Header & Close */}
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      selectedHazard.severity === 'critical'
                        ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                    }`}
                  >
                    {selectedHazard.severity} Severity
                  </span>
                  <span className="text-xs font-mono text-slate-400">ID: {selectedHazard.id}</span>
                </div>
                <h2 className="font-heading text-xl font-bold text-slate-100">
                  {selectedHazard.title}
                </h2>
              </div>
              <button
                onClick={() => setIsSheetOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Content Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Photo Card */}
              <div className="col-span-1 rounded-xl border border-slate-800 overflow-hidden relative aspect-video sm:aspect-square bg-slate-900 group">
                <img
                  src={selectedHazard.image}
                  alt={selectedHazard.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 border-2 border-amber-500/40 rounded-xl pointer-events-none" />
                <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-md rounded px-2 py-0.5 text-[10px] font-mono text-cyan-400 flex items-center gap-1 border border-cyan-500/30">
                  <span className="material-symbols-outlined text-[12px]">center_focus_strong</span>
                  AI CONF {selectedHazard.confidence}
                </div>
              </div>

              {/* Details Meta Grid — severity, confidence, coords, accuracy, time */}
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">GPS Coordinates</span>
                  <span className="text-xs font-mono font-bold text-cyan-400 truncate">{selectedHazard.coordsText}</span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">GPS Accuracy</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">{selectedHazard.gps_accuracy}</span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">AI Confidence</span>
                  <span className="text-xs font-mono font-bold text-amber-400">{selectedHazard.confidence}</span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Detected At</span>
                  <span className="text-xs font-mono font-bold text-slate-200 truncate">{selectedHazard.detectedTime}</span>
                </div>
              </div>
            </div>

            {/* Actions Area */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => handleNavigateMap(selectedHazard)}
                className="flex-1 bg-slate-900 border border-slate-700/80 hover:border-amber-500/40 rounded-xl py-3 flex items-center justify-center gap-2 text-slate-200 font-semibold text-sm hover:bg-slate-800 transition-all active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-lg">directions</span>
                Navigate
              </button>

              <button
                onClick={() => handleReportIssue(selectedHazard)}
                className="flex-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm py-3 rounded-xl shadow-[0_4px_20px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_28px_rgba(245,158,11,0.5)] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                  assignment
                </span>
                Report Issue
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
