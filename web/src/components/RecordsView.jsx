import { useState, useEffect, useCallback } from "react";

export default function RecordsView({ apiUrl, showToast, onNavigate }) {
  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const base = (apiUrl || "https://handprint-earmark-babied.ngrok-free.dev").replace(/\/+$/, "");

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${base}/api/potholes`, {
        headers: { "Bypass-Tunnel-Reminder": "true" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRecords(data);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err) {
      showToast?.(`Failed to load records: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // CSV export
  const handleExportCSV = () => {
    if (records.length === 0) {
      showToast?.("No records to export.", "error");
      return;
    }
    const headers = ["ID", "Latitude", "Longitude", "Confidence (%)", "Severity", "GPS Accuracy (m)", "Date/Time", "Class"];
    const rows = records.map(r => [
      r.id,
      r.latitude?.toFixed(6) ?? "",
      r.longitude?.toFixed(6) ?? "",
      r.confidence?.toFixed(1) ?? "",
      r.severity ?? "",
      r.gps_accuracy != null ? parseFloat(r.gps_accuracy).toFixed(1) : "N/A",
      r.timestamp ? new Date(r.timestamp).toLocaleString() : "",
      r.class_name ?? "pothole",
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `pothole_records_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast?.(`Exported ${records.length} records as CSV`, "success");
  };

  const handleViewOnMap = (rec) => {
    onNavigate?.("map");
    showToast?.(`Navigate to Map \u2014 lat ${rec.latitude?.toFixed(4)}, lng ${rec.longitude?.toFixed(4)}`, "info");
  };

  const severityClass = (sev) =>
    sev === "critical"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : sev === "moderate"
      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : "bg-slate-700/40 text-slate-300 border-slate-600/30";

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-6 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <span className="material-symbols-outlined text-2xl">dataset</span>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-100 font-heading">Pothole Records</h1>
            <p className="text-xs text-slate-400">
              {records.length} GPS-tagged detection{records.length !== 1 ? "s" : ""} stored in database
              {lastRefresh && <span className="ml-2 text-slate-500">· refreshed {lastRefresh}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/40 text-slate-200 rounded-xl text-xs font-semibold transition-all"
          >
            <span className={`material-symbols-outlined text-base text-amber-400 ${loading ? "animate-spin" : ""}`}>refresh</span>
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-bold shadow-[0_0_16px_rgba(245,158,11,0.3)] transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-base">download</span>
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-amber-500/20 border-t-amber-400 animate-spin" />
            <span className="text-xs text-slate-400 font-mono">Loading records from database...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="material-symbols-outlined text-4xl text-slate-600">gps_off</span>
            <p className="text-sm font-bold text-slate-300">No pothole records yet</p>
            <p className="text-xs text-slate-500">Go to Scan \u2192 Live Stream HUD, grant GPS access and detect potholes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800">
                  {["ID", "Latitude", "Longitude", "Confidence", "Severity", "GPS Accuracy", "Date / Time", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((rec, idx) => (
                  <tr
                    key={rec.id}
                    className={`border-b border-slate-800/60 transition-colors hover:bg-slate-800/40 ${idx % 2 === 0 ? "" : "bg-slate-900/30"}`}
                  >
                    <td className="px-4 py-3 text-amber-400 font-bold">#{rec.id}</td>
                    <td className="px-4 py-3 text-cyan-400">{rec.latitude?.toFixed(6) ?? "\u2014"}</td>
                    <td className="px-4 py-3 text-cyan-400">{rec.longitude?.toFixed(6) ?? "\u2014"}</td>
                    <td className="px-4 py-3 text-amber-300 font-bold">{rec.confidence?.toFixed(1) ?? "\u2014"}%</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${severityClass(rec.severity)}`}>
                        {rec.severity ?? "\u2014"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-emerald-400">
                      {rec.gps_accuracy != null ? `\u00b1${parseFloat(rec.gps_accuracy).toFixed(0)} m` : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {rec.timestamp ? new Date(rec.timestamp).toLocaleString() : "\u2014"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleViewOnMap(rec)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/40 text-slate-300 hover:text-amber-400 rounded-lg transition-all text-[10px] font-bold"
                        title="View on Map"
                      >
                        <span className="material-symbols-outlined text-xs">pin_drop</span>
                        Map
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats footer */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Records", value: records.length, color: "text-amber-400" },
            { label: "Critical", value: records.filter(r => r.severity === "critical").length, color: "text-red-400" },
            { label: "Moderate", value: records.filter(r => r.severity === "moderate").length, color: "text-amber-300" },
            { label: "Avg Confidence", value: `${(records.reduce((s, r) => s + (r.confidence || 0), 0) / records.length).toFixed(1)}%`, color: "text-cyan-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{label}</span>
              <span className={`text-2xl font-extrabold font-heading ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
