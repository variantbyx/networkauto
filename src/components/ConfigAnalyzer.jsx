import React, { useState } from "react";

function ConfigAnalyzer({ onAnalyze, initialValue = "" }) {
  const [configText, setConfigText] = useState(initialValue);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const sampleConfig = `hostname TEST-ROUTER
type router
role core
mgmt-ip 192.168.1.1/24
vlan 10
vlan 20
vlan 5000

interface Gig0/0
 ip address 192.168.1.1/24
 gateway 192.168.1.254

interface Gig0/1
 ip address 10.0.0.1/30
 gateway 10.0.0.2

bgp neighbor 10.0.0.2
bgp neighbor 10.0.0.3
bgp neighbor 999.999.999.999

access-list 100 permit any any
access-list 110 permit tcp any any eq 80

ospf`;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!configText.trim()) {
      return;
    }

    setIsAnalyzing(true);
    try {
      await onAnalyze(configText);
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="config-analyzer">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">Python-backed Analyzer</p>
          <h3>Paste a device config</h3>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="analyzer-form">
        <textarea
          value={configText}
          onChange={(event) => setConfigText(event.target.value)}
          placeholder="Paste a device config"
          rows={10}
          className="config-textarea"
          spellCheck="false"
        />

        <div className="analyzer-actions">
          <button
            type="button"
            onClick={() => setConfigText(sampleConfig)}
            className="sample-btn"
          >
            Load Sample
          </button>
          <button
            type="submit"
            disabled={isAnalyzing || !configText.trim()}
            className="analyze-btn"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Config"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setConfigText("")}
          className="reset-btn"
        >
          Reset sample text
        </button>
      </form>

      <div className="analyzer-info">
        <p>Supported validations:</p>
        <ul>
          <li>Duplicate IP detection</li>
          <li>Gateway and subnet checks</li>
          <li>VLAN range validation</li>
          <li>BGP neighbor IP validation</li>
          <li>ACL security warnings</li>
          <li>Routing protocol consistency</li>
        </ul>
      </div>
    </div>
  );
}

export default React.memo(ConfigAnalyzer);
