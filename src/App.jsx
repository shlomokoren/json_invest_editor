import React, { useEffect, useState } from "react";
import { googleLogout, useGoogleLogin } from "@react-oauth/google";

const allowedEmail = import.meta.env.VITE_ALLOWED_GOOGLE_EMAIL || "";
const FILE_ID = import.meta.env.VITE_DRIVE_FILE_ID;
function GoogleGIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M9 3.48c1.69 0 2.84.73 3.49 1.34l2.38-2.38C13.5.94 11.43 0 9 0 5.48 0 2.44 1.98.96 4.86l2.97 2.31C4.68 5.52 6.64 3.48 9 3.48z"
      />
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.12-.84 2.07-1.79 2.7l2.73 2.12C16.67 13.9 17.64 11.72 17.64 9.2z"
      />
      <path
        fill="#FBBC05"
        d="M3.93 10.41a5.41 5.41 0 010-3.42L.96 4.86a9 9 0 000 8.28l2.97-2.31z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.16l-2.73-2.12c-.75.5-1.7.8-3.23.8-2.36 0-4.32-2.04-5.07-4.71l-2.97 2.31C2.44 16.02 5.48 18 9 18z"
      />
      <path fill="none" d="M0 0h18v18H0z" />
    </svg>
  );
}

function GoogleButton({ onClick, children = "Sign in with Google", disabled }) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 40,
    padding: "0 14px",
    borderRadius: 4,
    border: "1px solid #dadce0",
    background: "#fff",
    color: "#3c4043",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    userSelect: "none",
    outline: "none",
  };
  const hover = { background: "#f8f9fa" };
  const active = { background: "#f1f3f4" };
  const disabledStyle = { opacity: 0.6, cursor: "not-allowed" };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Sign in with Google"
      style={{ ...base, ...(disabled ? disabledStyle : null) }}
      onMouseDown={(e) =>
        (e.currentTarget.style.background = active.background)
      }
      onMouseUp={(e) => (e.currentTarget.style.background = hover.background)}
      onMouseLeave={(e) => (e.currentTarget.style.background = base.background)}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = hover.background)
      }
      onFocus={(e) =>
        (e.currentTarget.style.boxShadow = "0 0 0 3px rgba(66,133,244,0.3)")
      }
      onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      <span
        style={{
          width: 18,
          height: 18,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
          borderRadius: 2,
        }}
      >
        <GoogleGIcon />
      </span>
      <span>{children}</span>
    </button>
  );
}
function PrimaryButton({ onClick, children, disabled }) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    padding: "0 14px",
    borderRadius: 6,
    border: "1px solid #5b86d6",
    background: "#6495ED", // ← your color
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: 0.2,
    cursor: "pointer",
    userSelect: "none",
    outline: "none",
    boxShadow: "0 1px 0 rgba(0,0,0,0.1)",
    transition: "background .15s ease, box-shadow .15s ease",
  };
  const hover = { background: "#5a86e0" }; // slightly darker
  const active = { background: "#5179cc" }; // pressed
  const disabledStyle = { opacity: 0.6, cursor: "not-allowed" };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...(disabled ? disabledStyle : null) }}
      onMouseEnter={(e) =>
        !disabled && (e.currentTarget.style.background = hover.background)
      }
      onMouseLeave={(e) =>
        !disabled && (e.currentTarget.style.background = base.background)
      }
      onMouseDown={(e) =>
        !disabled && (e.currentTarget.style.background = active.background)
      }
      onMouseUp={(e) =>
        !disabled && (e.currentTarget.style.background = hover.background)
      }
      onFocus={(e) =>
        !disabled &&
        (e.currentTarget.style.boxShadow = "0 0 0 3px rgba(100,149,237,0.35)")
      }
      onBlur={(e) =>
        (e.currentTarget.style.boxShadow = "0 1px 0 rgba(0,0,0,0.1)")
      }
    >
      {children}
    </button>
  );
}

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
            <GoogleButton onClick={() => signIn()} />

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
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <PrimaryButton onClick={loadJson} disabled={!user}>
                  Load JSON
                </PrimaryButton>
                <PrimaryButton onClick={saveJson} disabled={!user}>
                  Save JSON
                </PrimaryButton>
                <PrimaryButton onClick={signOut}>Sign out</PrimaryButton>
              </div>
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
