import { useState, useEffect, useCallback } from "react";

interface OfflineStatus {
  isOnline: boolean;
  /** Number of queued mutations waiting to sync */
  pendingMutations: number;
  /** Whether a sync just completed */
  justSynced: boolean;
}

/**
 * Hook to track online/offline status and offline mutation queue.
 * Also notifies the Service Worker when coming back online.
 */
export function useOfflineStatus(): OfflineStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingMutations, setPendingMutations] = useState(0);
  const [justSynced, setJustSynced] = useState(false);

  const checkPendingMutations = useCallback(async () => {
    try {
      const req = indexedDB.open("symptom-diary-offline", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("mutations")) {
          db.createObjectStore("mutations", { keyPath: "id", autoIncrement: true });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction("mutations", "readonly");
          const store = tx.objectStore("mutations");
          const countReq = store.count();
          countReq.onsuccess = () => {
            setPendingMutations(countReq.result);
          };
          tx.oncomplete = () => db.close();
        } catch {
          db.close();
        }
      };
    } catch {
      // IndexedDB not available
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Notify SW to replay queued mutations
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "ONLINE" });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "OFFLINE_SYNC_COMPLETE") {
        setJustSynced(true);
        setPendingMutations(0);
        // Clear the "just synced" flag after 3 seconds
        setTimeout(() => setJustSynced(false), 3000);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    navigator.serviceWorker?.addEventListener("message", handleSwMessage);

    // Check pending mutations on mount and when coming online
    checkPendingMutations();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener("message", handleSwMessage);
    };
  }, [checkPendingMutations]);

  // Recheck pending mutations when offline status changes
  useEffect(() => {
    if (!isOnline) {
      const interval = setInterval(checkPendingMutations, 5000);
      return () => clearInterval(interval);
    }
  }, [isOnline, checkPendingMutations]);

  return { isOnline, pendingMutations, justSynced };
}
