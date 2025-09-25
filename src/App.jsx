import React, { useEffect, useState } from "react";
import { googleLogout, useGoogleLogin } from "@react-oauth/google";

const allowedEmail = import.meta.env.VITE_ALLOWED_GOOGLE_EMAIL || "";
const FILE_ID = import.meta.env.VITE_DRIVE_FILE_ID;

export default function App() {
  const [user, setUser] = useState(null); // { email, name, picture }
  const [accessToken, setAccessToken] = useState("");
  const [tokenExpiresAt, setTokenExpiresAt] = useState(0);
  const [jsonText, setJsonText] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // ---- ONE BUTTON: sign in AND get Drive token in the same flow ----
  const signIn = useGoogleLogin({
    flow: "implicit",
    // ask for identity + Drive together
    scope: "openid email profile https://www.googleapis.com/auth/drive",
    ux_mode: "popup",
    onSuccess: async (resp) => {
      try {
        const token = resp?.access_token;
        if (!token) throw new Error("No access token from Google");
        const ttl = (resp.expires_in ?? 3600) - 60; // refresh 1 min early
        setAccessToken(token);
        setTokenExpiresAt(Date.now() + ttl * 1000);

        // fetch profile using the SAME token (no second auth)
        const me = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        ).then((r) => r.json());

        if (!me?.email) throw new Error("Could not read user profile");
        if (allowedEmail && me.email !== allowedEmail) {
          throw new Error(
            `This app is restricted to ${allowedEmail}. You signed in as ${me.email}.`
          );
        }

        setUser({ email: me.email, name: me.name, picture: me.picture });
        setStatus("Signed in ✓");
        setError("");
      } catch (e) {
        console.error(e);
        setError(e.message || "Sign-in failed.");
      }
    },
    onError: () => setError("Sign-in failed."),
  });

  function signOut() {
    googleLogout(); // clears Google session cookie (optional)
    setUser(null);
    setAccessToken("");
    setTokenExpiresAt(0);
    setJsonText("");
    setStatus("");
    setError("");
  }

  // silently refresh the token when needed (no extra prompt)
  async function ensureDriveToken() {
    if (!accessToken || Date.now() > tokenExpiresAt) {
      await signIn({ prompt: "" }); // silent re-auth with same account
    }
  }

  async function loadJson() {
    setError("");
    setStatus("Loading JSON...");
    if (!FILE_ID) {
      setError("Missing VITE_DRIVE_FILE_ID.");
      setStatus("");
      return;
    }
    await ensureDriveToken();
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${FILE_ID}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) throw new Error(`Drive download failed (${res.status})`);
      const txt = await res.text();
      try {
        setJsonText(JSON.stringify(JSON.parse(txt), null, 2));
      } catch {
        setJsonText(txt);
      }
      setStatus("Loaded ✓");
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load file.");
      setStatus("");
    }
  }

  async function saveJson() {
    setError("");
    setStatus("Saving JSON...");
    if (!FILE_ID) {
      setError("Missing VITE_DRIVE_FILE_ID.");
      setStatus("");
      return;
    }
    let body = jsonText;
    try {
      body = JSON.stringify(JSON.parse(jsonText));
    } catch {
      setError("Invalid JSON. Fix and try again.");
      setStatus("");
      return;
    }

    await ensureDriveToken();
    try {
      const res = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${FILE_ID}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
          },
          body,
        }
      );
      if (!res.ok) throw new Error(`Drive upload failed (${res.status})`);
      setStatus("Saved ✓");
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to save file.");
      setStatus("");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          width: 720,
          maxWidth: "95%",
          padding: 24,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>json_invest_editor</h1>

        {!user ? (
          <>
            <p>
              Sign in with Google {allowedEmail ? `(${allowedEmail})` : ""} to
              edit your Drive JSON file.
            </p>
            <button onClick={() => signIn()} style={{ padding: "10px 14px" }}>
              Sign in with Google
            </button>
            {error && <p style={{ color: "crimson" }}>⚠️ {error}</p>}
          </>
        ) : (
          <>
            <p style={{ marginBottom: 8 }}>
              ✅ Signed in as <strong>{user.email}</strong>{" "}
              {user.picture && (
                <img
                  alt=""
                  src={user.picture}
                  style={{
                    height: 24,
                    verticalAlign: "middle",
                    borderRadius: 12,
                    marginLeft: 8,
                  }}
                />
              )}
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button onClick={loadJson} style={{ padding: "8px 12px" }}>
                Load JSON
              </button>
              <button onClick={saveJson} style={{ padding: "8px 12px" }}>
                Save JSON
              </button>
              <button
                onClick={signOut}
                style={{ marginLeft: 12, padding: "8px 12px" }}
              >
                Sign out
              </button>
            </div>

            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder="Your JSON will appear here after Load"
              style={{
                marginTop: 12,
                width: "100%",
                height: 360,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: 14,
                padding: 12,
                borderRadius: 8,
                border: "1px solid #ccc",
                lineHeight: 1.4,
                whiteSpace: "pre",
              }}
            />

            {(status || error) && (
              <p
                style={{ marginTop: 10, color: error ? "crimson" : "inherit" }}
              >
                {error ? `⚠️ ${error}` : `ℹ️ ${status}`}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
