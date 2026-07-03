import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const result = isLogin
      ? await login(formData.email, formData.password)
      : await register(formData.username, formData.email, formData.password);

    if (result.success) {
      navigate("/");
    } else {
      setError(result.error);
    }

    setSubmitting(false);
  }

  return (
    <div className="auth-shell">
      <div className="auth-card glass-panel">
        <p className="eyebrow">Network Automation Dashboard</p>
        <h1>{isLogin ? "Sign In" : "Create Account"}</h1>
        <p className="auth-copy">
          Access the dashboard, analyze configs, and track network health in
          real time.
        </p>

        {error ? <div className="auth-error">{error}</div> : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin ? (
            <label>
              <span>Username</span>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                minLength={3}
                maxLength={20}
                required
              />
            </label>
          ) : null}

          <label>
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              minLength={6}
              required
            />
          </label>

          <button
            className="primary-button auth-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Working..." : isLogin ? "Sign In" : "Register"}
          </button>
        </form>

        <button
          className="ghost-button auth-switch"
          type="button"
          onClick={() => {
            setError("");
            setIsLogin((current) => !current);
          }}
        >
          {isLogin
            ? "Need an account? Register"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

export default Login;
