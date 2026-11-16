import React, { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DemoPresenterBar, PATH_TO_ROLE } from "@/components/DemoPresenterBar";
import { apiFetch, buildWsUrl } from "@/lib/api";
import { applyTenantThemeVars, playAlertChime } from "@/lib/utils";
import { AppRole, useAppStore } from "@/store/useAppStore";
import { CustomerView } from "@/views/CustomerView";
import { KitchenKDSView } from "@/views/KitchenKDSView";
import { ManagerFloorView } from "@/views/ManagerFloorView";
import { SuperAdminView } from "@/views/SuperAdminView";

export const App: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    activeRestaurantId,
    activeRole,
    staffToken,
    activeSession,
    setActiveRole,
    setStaffAuth,
    setLastAmberAlert,
  } = useAppStore();

  // Sync URL pathname (/customer, /kitchen, /manager, /owner, /super-admin) with active portal role
  useEffect(() => {
    const syncFromPath = () => {
      const path = window.location.pathname.toLowerCase();
      const matchedRole: AppRole = PATH_TO_ROLE[path] || "customer";
      if (matchedRole === "customer") {
        setActiveRole("customer");
      } else {
        apiFetch("/api/auth/demo-switch", {
          method: "POST",
          body: JSON.stringify({
            role: matchedRole,
            restaurant_id: activeRestaurantId,
          }),
        })
          .then((res) => {
            setStaffAuth(res.access_token, res.name, matchedRole);
          })
          .catch(() => {
            setActiveRole(matchedRole);
          });
      }
    };

    syncFromPath();
    window.addEventListener("popstate", syncFromPath);
    return () => window.removeEventListener("popstate", syncFromPath);
  }, [activeRestaurantId]);

  // Fetch active tenant config and apply CSS theme variables
  const { data: restaurant } = useQuery<any>({
    queryKey: ["restaurant", activeRestaurantId],
    queryFn: () => apiFetch(`/api/restaurants/${activeRestaurantId}`),
  });

  useEffect(() => {
    if (restaurant?.theme) {
      applyTenantThemeVars(restaurant.theme);
    }
  }, [restaurant]);

  // Ensure a valid demo staff token is available for WebSocket & staff views
  useEffect(() => {
    if (!staffToken) {
      apiFetch("/api/auth/demo-switch", {
        method: "POST",
        body: JSON.stringify({
          role: activeRole === "customer" ? "manager" : activeRole,
          restaurant_id: activeRestaurantId,
        }),
      })
        .then((res) => {
          useAppStore.setState({ staffToken: res.access_token });
        })
        .catch(() => {});
    }
  }, [activeRestaurantId, staffToken, activeRole]);

  // Connect to isolated per-restaurant WebSocket channel (/ws/{restaurant_id}?token=...)
  useEffect(() => {
    const wsToken =
      activeRole === "customer"
        ? activeSession?.session_token || staffToken
        : staffToken;

    if (!wsToken || !activeRestaurantId) return;

    const url = buildWsUrl(activeRestaurantId, wsToken);
    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const type = msg.type;
        if (type === "TABLE_AMBER_ALERT") {
          playAlertChime("amber");
          setLastAmberAlert({
            table_number: msg.payload.table_number,
            guest_count: msg.payload.guest_count,
            source: msg.payload.source,
            message: msg.payload.message,
            timestamp: msg.timestamp,
          });
          queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
        } else if (
          type === "ORDER_CREATED" ||
          type === "ORDER_UPDATED" ||
          type === "ORDER_PAID"
        ) {
          if (type === "ORDER_CREATED") playAlertChime("order");
          queryClient.invalidateQueries({ queryKey: ["orders", activeRestaurantId] });
          queryClient.invalidateQueries({ queryKey: ["session-orders"] });
          queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
          queryClient.invalidateQueries({ queryKey: ["analytics", activeRestaurantId] });
          queryClient.invalidateQueries({ queryKey: ["settlements", activeRestaurantId] });
          queryClient.invalidateQueries({ queryKey: ["super-admin-overview"] });
        } else if (type === "TABLE_STATUS_CHANGED" || type === "SESSION_VERIFIED") {
          queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
        } else if (
          type === "SERVICE_REQUEST_CREATED" ||
          type === "SERVICE_REQUEST_UPDATED"
        ) {
          if (type === "SERVICE_REQUEST_CREATED") playAlertChime("service");
          queryClient.invalidateQueries({ queryKey: ["service-requests", activeRestaurantId] });
        } else if (type === "TENANT_CONFIG_UPDATED" || type === "MENU_UPDATED") {
          queryClient.invalidateQueries({ queryKey: ["restaurant", activeRestaurantId] });
          queryClient.invalidateQueries({ queryKey: ["restaurants"] });
          queryClient.invalidateQueries({ queryKey: ["menu", activeRestaurantId] });
        }
      } catch {
        // ignore malformed message
      }
    };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 20000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, [activeRestaurantId, activeRole, staffToken, activeSession?.session_token, queryClient]);

  return (
    <div className="min-h-screen bg-[#F7F5F2] text-[#141414] flex flex-col">
      <main className="flex-1">
        {activeRole === "customer" && <CustomerView />}
        {activeRole === "kitchen" && <KitchenKDSView />}
        {(activeRole === "manager" || activeRole === "owner" || activeRole === "waiter") && (
          <ManagerFloorView />
        )}
        {activeRole === "super_admin" && <SuperAdminView />}
      </main>
      <DemoPresenterBar />
    </div>
  );
};

export default App;
