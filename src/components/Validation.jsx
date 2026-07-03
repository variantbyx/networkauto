import React from "react";

function renderIssueList(title, issues) {
  if (!issues || issues.length === 0) {
    return null;
  }

  return (
    <div className="error-category">
      <h4>{title}</h4>
      <ul>
        {issues.map((issue, index) => {
          if (typeof issue === "string") {
            return <li key={`${title}-${index}`}>{issue}</li>;
          }

          if (issue?.ip) {
            return (
              <li key={`${title}-${issue.ip}-${index}`}>
                {issue.ip}{" "}
                {issue.devices ? `on ${issue.devices.join(", ")}` : ""}
              </li>
            );
          }

          return (
            <li key={`${title}-${index}`}>
              {issue.device || "Device"} {issue.interface || "interface"}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Validation({ validation }) {
  if (!validation) {
    return (
      <div className="validation-panel glass-panel">No validation data</div>
    );
  }

  const totalIssues =
    (validation.duplicateIps?.length || 0) +
    (validation.gatewayIssues?.length || 0) +
    (validation.vlanIssues?.length || 0) +
    (validation.bgpIssues?.length || 0) +
    (validation.aclIssues?.length || 0) +
    (validation.routingIssues?.length || 0);

  const hasErrors = validation.hasErrors || totalIssues > 0;

  return (
    <div className="validation-panel glass-panel">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">Validation</p>
          <h3>Validation Issues</h3>
        </div>
      </div>

      {!hasErrors ? (
        <div className="validation-success">No validation issues detected.</div>
      ) : (
        <div className="validation-errors">
          <div className="error-count">⚠️ {totalIssues} issues found</div>
          {renderIssueList("Duplicate IPs", validation.duplicateIps)}
          {renderIssueList("Gateway Issues", validation.gatewayIssues)}
          {renderIssueList("VLAN Issues", validation.vlanIssues)}
          {renderIssueList("BGP Issues", validation.bgpIssues)}
          {renderIssueList("ACL Security Issues", validation.aclIssues)}
          {renderIssueList("Routing Issues", validation.routingIssues)}
        </div>
      )}
    </div>
  );
}

export default React.memo(Validation);
