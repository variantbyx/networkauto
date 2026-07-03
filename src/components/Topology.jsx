import React, { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";

function Topology({
  devices = [],
  links = [],
  deviceStatus = {},
  metrics = {},
}) {
  const svgRef = useRef(null);

  const nodes = useMemo(
    () =>
      devices.map((device, index) => ({
        id: device.name || device.deviceName || `device-${index}`,
        name: device.name || device.deviceName || `Device ${index + 1}`,
        type: device.type || device.deviceType || "router",
      })),
    [devices],
  );

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) {
      return undefined;
    }

    const width = 760;
    const height = 420;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const simulationNodes = nodes.map((node) => ({ ...node }));
    const simulationLinks = links
      .map((link) => ({
        source: nodeMap.get(link.source) || { id: link.source },
        target: nodeMap.get(link.target) || { id: link.target },
      }))
      .filter((link) => link.source && link.target);

    const linkSelection = svg
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(simulationLinks)
      .enter()
      .append("line")
      .attr("class", "topology-link")
      .attr("stroke", "url(#linkGradient)");

    const nodeGroup = svg.append("g").attr("class", "nodes");
    const nodeSelection = nodeGroup
      .selectAll("g")
      .data(simulationNodes)
      .enter()
      .append("g")
      .attr("class", "topology-node");

    nodeSelection
      .append("circle")
      .attr("class", (d) => {
        const liveStatus =
          deviceStatus[d.id]?.status ||
          devices.find((device) => device.name === d.id)?.status ||
          "online";
        return `node-radar status-${liveStatus}`;
      })
      .attr("r", 34);

    nodeSelection
      .append("circle")
      .attr("class", (d) => {
        const liveStatus =
          deviceStatus[d.id]?.status ||
          devices.find((device) => device.name === d.id)?.status ||
          "online";
        return `node-core status-${liveStatus}`;
      })
      .attr("r", 22);

    nodeSelection
      .append("text")
      .attr("class", "node-label")
      .attr("text-anchor", "middle")
      .attr("y", 52)
      .text((d) => d.name);

    nodeSelection
      .append("text")
      .attr("class", "node-subtitle")
      .attr("text-anchor", "middle")
      .attr("y", 69)
      .text((d) => d.type);

    nodeSelection
      .append("text")
      .attr("class", "node-status")
      .attr("text-anchor", "middle")
      .attr("y", -46)
      .text((d) => (deviceStatus[d.id]?.status || "online").toUpperCase());

    const simulation = d3
      .forceSimulation(simulationNodes)
      .force(
        "link",
        d3
          .forceLink(simulationLinks)
          .id((d) => d.id)
          .distance(150),
      )
      .force("charge", d3.forceManyBody().strength(-520))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(56))
      .on("tick", () => {
        linkSelection
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

        nodeSelection.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
      });

    return () => simulation.stop();
  }, [nodes, links, deviceStatus]);

  const onlineCount = devices.filter((device) => {
    const deviceKey = device.name || device.deviceName;
    return (
      (deviceStatus[deviceKey]?.status || device.status || "online") ===
      "online"
    );
  }).length;

  return (
    <div className="topology-container">
      <div className="topology-summary">
        <span>{devices.length} devices</span>
        <span>{links.length} links</span>
        <span>{onlineCount} online</span>
        <span>
          {metrics?.latency ? `${metrics.latency} ms latency` : "live status"}
        </span>
      </div>

      <svg ref={svgRef} aria-label="Topology visualization">
        <defs>
          <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#69d2ff" />
            <stop offset="100%" stopColor="#9bffd1" />
          </linearGradient>
        </defs>
      </svg>

      <p className="last-refresh">
        Last refreshed: {new Date().toLocaleTimeString()}
      </p>
    </div>
  );
}

export default React.memo(Topology);
