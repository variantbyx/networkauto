import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { buildApiUrl } from "../config/runtime";

const AuthContext = createContext(null);
const api = axios.create({ baseURL: buildApiUrl("/api") });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      setLoading(false);
      return;
    }

    try {
      const decoded = jwtDecode(storedToken);
      if (decoded.exp * 1000 < Date.now()) {
        logout();
        return;
      }

      setToken(storedToken);
      api.defaults.headers.common.Authorization = `Bearer ${storedToken}`;
      setUser({
        id: decoded.userId,
        email: decoded.email,
      });
    } catch (_error) {
      logout();
    } finally {
      setLoading(false);
    }
  }, []);

  async function login(email, password) {
    try {
      const response = await api.post("/auth/login", { email, password });
      const { token: nextToken, user: nextUser } = response.data;
      localStorage.setItem("token", nextToken);
      api.defaults.headers.common.Authorization = `Bearer ${nextToken}`;
      setToken(nextToken);
      setUser(nextUser);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "Login failed",
      };
    }
  }

  async function register(username, email, password) {
    try {
      const response = await api.post("/auth/register", {
        username,
        email,
        password,
      });
      const { token: nextToken, user: nextUser } = response.data;
      localStorage.setItem("token", nextToken);
      api.defaults.headers.common.Authorization = `Bearer ${nextToken}`;
      setToken(nextToken);
      setUser(nextUser);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "Registration failed",
      };
    }
  }

  function logout() {
    localStorage.removeItem("token");
    delete api.defaults.headers.common.Authorization;
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
