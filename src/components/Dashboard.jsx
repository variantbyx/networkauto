import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { buildApiUrl, getSocketUrl } from "../config/runtime";
import Topology from "./Topology";
import Validation from "./Validation";
import ConfigAnalyzer from "./ConfigAnalyzer";
import DeviceList from "./DeviceList";
import Notifications from "./Notifications";

const socketBaseUrl = getSocketUrl();

const defaultCustomConfig = `hostname LAB-EDGE
type router
role branch
mgmt-ip 192.168.1.10/24
vlan 50

interface Gig0/0
 ip address 192.168.1.10/24
 gateway 192.168.1.254
 link LAB-SW1 Gig0/1

bgp neighbor 10.0.0.2
access-list 100 permit any any
ospf`;

function normalizeAnalysisResult(result) {
  const device = result?.device || {};
  const interfaces = device.interfaces || [];
  const links = [];

  interfaces.forEach((interfaceItem) => {
    (interfaceItem.links || []).forEach((link) => {
      links.push({
        source: device.name || device.deviceName || "device",
        sourceInterface: interfaceItem.name,
        target: link.peerDevice,
        targetInterface: link.peerInterface,
      });
    });
  });

  const normalizedDevice = {
    name: device.name || device.deviceName || "device",
    type: device.type || device.deviceType || "router",
    role: device.role || "edge",
    managementIp: device.managementIp || device.mgmt_ip || null,
    vlans: device.vlans || [],
    interfaces,
    bgp_neighbors: device.bgp_neighbors || [],
    acl_rules: device.acl_rules || [],
    routing_protocols: device.routing_protocols || [],
  };

  return {
    devices: [normalizedDevice],
    links,
    vlans: (device.vlans || []).map((vlanId) => ({
      id: vlanId,
      devices: [normalizedDevice.name],
    })),
    validation: result?.validation || {},
    metrics: {
      deviceCount: 1,
      linkCount: links.length,
      vlanCount: (device.vlans || []).length,
      duplicateIpCount: result?.validation?.duplicateIps?.length || 0,
      gatewayIssueCount: result?.validation?.gatewayIssues?.length || 0,
      bgpIssueCount: result?.validation?.bgpIssues?.length || 0,
      aclIssueCount: result?.validation?.aclIssues?.length || 0,
      routingIssueCount: result?.validation?.routingIssues?.length || 0,
      healthyCount: result?.validation?.hasErrors ? 0 : 1,
      uptimePercent: result?.validation?.hasErrors ? 0 : 100,
    },
    generatedAt: new Date().toISOString(),
  };
}

function Dashboard() {
  const { token, logout, user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [deviceStatus, setDeviceStatus] = useState({});
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceMode, setSourceMode] = useState("sample");
  const socketRef = useRef(null);
  const alertTimersRef = useRef([]);

  async function fetchDashboard() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(buildApiUrl("/api/dashboard"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json();

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error || payload.message || "Failed to load dashboard",
        );
      }

      setDashboardData(payload.data);
      setSourceMode("sample");
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
  }, [token]);

  useEffect(() => {
    socketRef.current = io(socketBaseUrl, {
      withCredentials: true,
      transports: ["websocket"],
    });

    socketRef.current.on("device_status_update", (data) => {
      setDeviceStatus((current) => ({
        ...current,
        [data.deviceId]: data,
      }));
    });

    socketRef.current.on("metric_update", (data) => {
      setMetrics((current) => ({
        ...current,
        [data.deviceId]: data,
      }));
    });

    socketRef.current.on("analysis_result", (result) => {
      setDashboardData(normalizeAnalysisResult(result));
      setSourceMode("custom");
    });

    socketRef.current.on("alert", (data) => {
      const alertId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const alertItem = { ...data, id: alertId };

      setAlerts((current) => [...current, alertItem]);

      const timerId = setTimeout(() => {
        setAlerts((current) => current.filter((alert) => alert.id !== alertId));
      }, 10000);

      alertTimersRef.current.push(timerId);
    });

    return () => {
      alertTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      alertTimersRef.current = [];
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const topMetrics = useMemo(() => {
    const devices = dashboardData?.devices || [];
    const onlineDevices = devices.filter((device) => {
      const liveStatus =
        deviceStatus[device.name]?.status || device.status || "online";
      return liveStatus === "online";
    }).length;

    return {
      devices: devices.length,
      online: onlineDevices,
      links: dashboardData?.links?.length || 0,
      duplicateIps: dashboardData?.validation?.duplicateIps?.length || 0,
      gatewayIssues: dashboardData?.validation?.gatewayIssues?.length || 0,
      vlans: dashboardData?.metrics?.vlanCount || 0,
      uptime: dashboardData?.metrics?.uptimePercent || 0,
    };
  }, [dashboardData, deviceStatus]);

  async function handleAnalyze(configText) {
    if (!configText.trim()) {
      return;
    }

    if (socketRef.current) {
      socketRef.current.emit("analyze_config", {
        config: configText,
        deviceName: "custom-lab",
        deviceType: "router",
      });
    }

    try {
      const response = await fetch(buildApiUrl("/api/config/analyze"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          configText,
          deviceName: "custom-lab",
          deviceType: "router",
        }),
      });

      const payload = await response.json();

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || payload.message || "Analysis failed");
      }

      setDashboardData(normalizeAnalysisResult(payload.data));
      setSourceMode("custom");
    } catch (analysisError) {
      setError(analysisError.message);
    }
  }

  if (loading && !dashboardData) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (!dashboardData) {
    return (
      <div className="loading">{error || "No dashboard data available"}</div>
    );
  }

  return (
    <div className="app-shell dashboard-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Network Automation & Monitoring</p>
          <h1>Network Automation Dashboard</h1>
          <p className="hero-copy">
            Real-time configuration analysis, topology monitoring, and history
            tracking for {user?.username || "your"} network operations.
          </p>
        </div>

        <div className="dashboard-header-actions">
          <span
            className={`pill ${sourceMode === "sample" ? "pill-success" : "pill-info"}`}
          >
            {sourceMode === "sample" ? "Sample topology" : "Custom analysis"}
          </span>
          <button className="ghost-button" type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <div className="metrics-grid">
        <article className="metric-card accent-cyan">
          <span>Devices</span>
          <strong>{topMetrics.devices}</strong>
          <p>Total detected devices in the active dataset.</p>
        </article>
        <article className="metric-card accent-lime">
          <span>Online</span>
          <strong>{topMetrics.online}</strong>
          <p>Devices currently reporting healthy status.</p>
        </article>
        <article className="metric-card accent-amber">
          <span>Links</span>
          <strong>{topMetrics.links}</strong>
          <p>Observed topology connections.</p>
        </article>
        <article className="metric-card accent-rose">
          <span>Uptime</span>
          <strong>{topMetrics.uptime}%</strong>
          <p>Simulated uptime across the fleet.</p>
        </article>
      </div>

      <section className="content-grid dashboard-grid-shell">
        <div className="main-content">
          <div className="topology-section glass-panel">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">Topology View</p>
                <h2>Network map</h2>
              </div>
              <p className="panel-meta">
                Live status updates every few seconds
              </p>
            </div>

            <Topology
              devices={dashboardData.devices}
              links={dashboardData.links}
              deviceStatus={deviceStatus}
              metrics={metrics}
            />
          </div>

          <div className="config-section glass-panel">
            <ConfigAnalyzer
              onAnalyze={handleAnalyze}
              initialValue={defaultCustomConfig}
            />
          </div>
        </div>

        <aside className="right-panel">
          <Validation validation={dashboardData.validation} />
          <DeviceList
            devices={dashboardData.devices}
            deviceStatus={deviceStatus}
            metrics={metrics}
          />
        </aside>
      </section>

      <Notifications alerts={alerts} />

      {error ? (
        <div className="error-banner dashboard-error">{error}</div>
      ) : null}
    </div>
  );
}

export default Dashboard;
