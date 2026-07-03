import React from "react";

function DeviceList({ devices = [], deviceStatus = {}, metrics = {} }) {
  if (!devices.length) {
    return <div className="device-list glass-panel">No devices</div>;
  }

  return (
    <div className="device-list glass-panel">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">Devices</p>
          <h3>Fleet Status</h3>
        </div>
      </div>

      {devices.map((device, index) => {
        const deviceName =
          device.name || device.deviceName || `Device ${index + 1}`;
        const status = deviceStatus[deviceName] || {
          status: device.status || "unknown",
        };
        const metric = metrics[deviceName] || {
          latency: device.latency,
          packetLoss: device.packetLoss,
        };
        const bgpCount = (device.bgp_neighbors || device.bgpNeighbors || [])
          .length;
        const aclCount = (device.acl_rules || device.aclRules || []).length;

        return (
          <div
            key={deviceName}
            className={`device-item ${status.status || "unknown"}`}
          >
            <div className="device-header">
              <div className="device-name">
                <span
                  className={`status-indicator ${status.status || "unknown"}`}
                />
                {deviceName}
              </div>
              <div className="device-type">
                {device.type || device.deviceType || "router"}
              </div>
            </div>

            <div className="device-details">
              <div className="device-detail">
                <span className="label">Mgmt IP:</span>
                <span>{device.managementIp || device.mgmt_ip || "N/A"}</span>
              </div>
              <div className="device-detail">
                <span className="label">VLANs:</span>
                <span>{(device.vlans || []).join(", ") || "None"}</span>
              </div>
              <div className="device-detail">
                <span className="label">Latency:</span>
                <span>
                  {metric?.latency === null || metric?.latency === undefined
                    ? "offline"
                    : `${metric.latency}ms`}
                </span>
              </div>
              <div className="device-detail">
                <span className="label">Packet Loss:</span>
                <span>{metric?.packetLoss ?? 0}%</span>
              </div>
              <div className="device-detail">
                <span className="label">BGP Neighbors:</span>
                <span>{bgpCount}</span>
              </div>
              <div className="device-detail">
                <span className="label">ACL Rules:</span>
                <span>{aclCount}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(DeviceList);
