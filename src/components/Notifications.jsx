import React from "react";

function Notifications({ alerts = [] }) {
  if (!alerts.length) {
    return null;
  }

  return (
    <div className="notifications-container">
      {alerts.map((alert) => (
        <div key={alert.id} className={`notification ${alert.type}`}>
          <div className="notification-content">
            <span className="notification-icon">
              {alert.type === "error" ? "❌" : "✅"}
            </span>
            <div className="notification-message">
              <strong>{alert.type === "error" ? "Alert" : "Success"}</strong>
              <p>{alert.message}</p>
              <small>{new Date(alert.timestamp).toLocaleTimeString()}</small>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default React.memo(Notifications);
