import React, { useEffect, useState } from "react";
import { GoogleLogin, googleLogout, useGoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

const allowedEmail = import.meta.env.VITE_ALLOWED_GOOGLE_EMAIL || "";
const FILE_ID = import.meta.env.VITE_DRIVE_FILE_ID;

function parseIdToken(credential) {
  try {
    const payload = jwtDecode(credential);
    return {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      exp: payload.exp,
    };
  } catch (e) {
    console.error("Failed to decode credential", e);
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(null); // { email, name, picture, exp }
  const [error, setError] = useState("");
  const [accessToken, setAccessToken] = useState(""); // Drive API token
  const [jsonText, setJsonText] = useState("");
  const [status, setStatus] = useState(""); // small UX message

  // Restore prior user + token from localStorage (demo-only persistence)
  useEffect(() => {
    const saved = localStorage.getItem("gis_credential");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.exp && parsed.exp * 1000 < Date.now()) {
        localStorage.removeItem("gis_credential");
      } else {
        setUser(parsed);
      }
    }
    const savedToken = localStorage.getItem("drive_access_token");
    if (savedToken) setAccessToken(savedToken);
  }, []);

  function handleLoginSuccess(resp) {
    setError("");
    const info = parseIdToken(resp.credential);
    if (!info) {
      setError("Could not read login credential.");
      return;
    }
    if (allowedEmail && info.email !== allowedEmail) {
      setError(
        `This app is restricted. Please sign in with ${allowedEmail}. (You signed in as ${info.email})`
      );
      setUser(null);
      return;
    }
    localStorage.setItem("gis_credential", JSON.stringify(info));
    setUser(info);
  }

  function signOut() {
    googleLogout();
    localStorage.removeItem("gis_credential");
    localStorage.removeItem("drive_access_token");
    setUser(null);
    setAccessToken("");
    setError("");
    setJsonText("");
    setStatus("");
  }

  // Request an OAuth access token with Drive scopes.
  // - For read-only: use 'https://www.googleapis.com/auth/drive.readonly'
  // - For read+write to any file the user can edit: use 'https://www.googleapis.com/auth/drive'
  const requestDriveToken = useGoogleLogin({
    flow: "implicit",
    scope: "https://www.googleapis.com/auth/drive", // allows read & write
    onSuccess: (tokenResponse) => {
      const token = tokenResponse?.access_token;
      if (!token) {
        setError("Did not receive an access token from Google.");
        return;
      }
      setAccessToken(token);
      localStorage.setItem("drive_access_token", token);
      setStatus("Drive connected ✓");
    },
    onError: () => setError("Failed to authorize Google Drive access."),
  });

  async function loadJson() {
    setError("");
    setStatus("Loading JSON...");
    if (!FILE_ID) {
      setError("Missing VITE_DRIVE_FILE_ID.");
      setStatus("");
      return;
    }
    if (!accessToken) {
      setError("Please connect Google Drive first.");
      setStatus("");
      return;
    }
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${FILE_ID}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Drive download failed (${res.status}): ${text}`);
      }
      const txt = await res.text();
      // Pretty-print if valid JSON, else show raw
      try {
        const obj = JSON.parse(txt);
        setJsonText(JSON.stringify(obj, null, 2));
      } catch {
        setJsonText(txt); // not strictly JSON — still show it
      }
      setStatus("Loaded ✓");
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load file from Drive.");
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
    if (!accessToken) {
      setError("Please connect Google Drive first.");
      setStatus("");
      return;
    }
    // Validate JSON before saving
    let toUpload = jsonText;
    try {
      const parsed = JSON.parse(jsonText);
      toUpload = JSON.stringify(parsed); // normalize
    } catch (e) {
      setError("Your content is not valid JSON. Please fix and try again.");
      setStatus("");
      return;
    }

    try {
      const res = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${FILE_ID}?uploadType=media`,
        {
          method: "PATCH", // PATCH or PUT both work for media; PATCH preferred
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
          },
          body: toUpload,
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Drive upload failed (${res.status}): ${text}`);
      }
      setStatus("Saved ✓");
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to save file to Drive.");
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

        {!user && (
          <>
            <p>
              Please authenticate with your Google account
              {allowedEmail ? ` (${allowedEmail})` : ""}.
            </p>
            <GoogleLogin
              onSuccess={handleLoginSuccess}
              onError={() =>
                setError(
                  "Login failed. Try again or choose a different Google account."
                )
              }
              useOneTap
            />
          </>
        )}

        {user && (
          <>
            <p style={{ marginBottom: 8 }}>
              ✅ Authenticated as <strong>{user.email}</strong>
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {!accessToken ? (
                <button
                  onClick={() => requestDriveToken()}
                  style={{ padding: "8px 12px" }}
                >
                  Connect Google Drive
                </button>
              ) : (
                <span style={{ fontSize: 14 }}>Drive connected ✅</span>
              )}
              <button
                onClick={loadJson}
                disabled={!accessToken}
                style={{ padding: "8px 12px" }}
              >
                Load JSON
              </button>
              <button
                onClick={saveJson}
                disabled={!accessToken}
                style={{ padding: "8px 12px" }}
              >
                Save JSON
              </button>
              <button
                onClick={signOut}
                style={{ marginLeft: "20px", padding: "8px 12px" }}
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
