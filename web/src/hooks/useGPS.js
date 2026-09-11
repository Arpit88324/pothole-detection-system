import { useState, useEffect, useRef } from "react";

/**
 * useGPS — keeps a live reference to the latest GPS fix via watchPosition,
 * but does NOT expose it continuously.  Instead it exposes getPositionOnce()
 * which resolves immediately with the cached fix (or waits up to 10 s for one).
 *
 * This ensures GPS is ONLY captured at the moment YOLO detects a pothole.
 *
 * Returns:
 *   gpsStatus — "requesting" | "active" | "denied" | "unavailable" | "unsupported"
 *   gpsError  — string | null  (human-readable for UI display)
 *   getPositionOnce — () => Promise<{lat, lng, accuracy, timestamp}>
 *                     Rejects with Error if GPS unavailable/denied.
 */
export function useGPS() {
  const [gpsStatus, setGpsStatus] = useState("requesting");
  const [gpsError,  setGpsError]  = useState(null);

  // Internal cache — never exposed as state to avoid triggering re-renders
  const cachedFix  = useRef(null);
  const watchIdRef = useRef(null);
  // Pending one-shot resolvers waiting for first fix
  const pendingRef = useRef([]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus("unsupported");
      setGpsError("Geolocation is not supported by this browser.");
      return;
    }

    setGpsStatus("requesting");

    const onSuccess = (position) => {
      const fix = {
        lat:       position.coords.latitude,
        lng:       position.coords.longitude,
        accuracy:  position.coords.accuracy,
        timestamp: position.timestamp,
      };
      cachedFix.current = fix;
      setGpsStatus("active");
      setGpsError(null);

      // Resolve any callers waiting for the first fix
      const pending = pendingRef.current.splice(0);
      pending.forEach(({ resolve }) => resolve(fix));
    };

    const onError = (err) => {
      let status = "unavailable";
      let msg    = err.message || "Unknown GPS error.";
      if (err.code === err.PERMISSION_DENIED) {
        status = "denied";
        msg    = "Location permission denied. Grant access in browser settings.";
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        msg = "GPS signal unavailable. Move to an open area.";
      } else if (err.code === err.TIMEOUT) {
        msg = "GPS timed out.";
      }
      setGpsStatus(status);
      setGpsError(msg);

      // Reject pending one-shot callers
      const pending = pendingRef.current.splice(0);
      pending.forEach(({ reject }) => reject(new Error(msg)));
    };

    const options = {
      enableHighAccuracy: true,
      timeout:            10000,
      maximumAge:         5000,
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      onSuccess, onError, options,
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  /**
   * Returns a promise that resolves with the latest GPS fix.
   * - If a fix is already cached, resolves immediately.
   * - If still waiting for first fix, queues and waits up to 10 s.
   * - If GPS is denied/unavailable, rejects immediately.
   */
  const getPositionOnce = () => {
    if (cachedFix.current) {
      return Promise.resolve(cachedFix.current);
    }
    const currentStatus = gpsStatus;
    if (currentStatus === "denied" || currentStatus === "unsupported") {
      return Promise.reject(new Error(gpsError || "GPS unavailable."));
    }
    // Still requesting — queue up
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remove from pending and reject
        pendingRef.current = pendingRef.current.filter(p => p.resolve !== resolve);
        reject(new Error("GPS timed out waiting for first fix."));
      }, 10000);
      pendingRef.current.push({
        resolve: (fix) => { clearTimeout(timer); resolve(fix); },
        reject:  (err) => { clearTimeout(timer); reject(err); },
      });
    });
  };

  return { gpsStatus, gpsError, getPositionOnce };
}
