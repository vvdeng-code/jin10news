import crypto from "node:crypto";
import http from "node:http";
import dotenv from "dotenv";

dotenv.config();

const REQUIRED = ["GMAIL_USER", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];
const missing = REQUIRED.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required env for OAuth setup: ${missing.join(", ")}`);
  process.exit(1);
}

const port = Number.parseInt(process.env.GOOGLE_OAUTH_PORT ?? "3000", 10);
const redirectUri = `http://127.0.0.1:${port}/oauth2/callback`;
const state = crypto.randomBytes(24).toString("hex");

function renderPage(title, message) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px;">
    <h1>${title}</h1>
    <p>${message}</p>
    <p>You can close this tab and return to the terminal.</p>
  </body>
</html>`;
}

async function exchangeCodeForTokens(code) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  const result = await response.json();
  if (!response.ok) {
    const details = typeof result === "object" ? JSON.stringify(result) : String(result);
    throw new Error(`Google token exchange failed: ${response.status} ${details}`);
  }

  return result;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

  if (url.pathname !== "/oauth2/callback") {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  try {
    const error = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");

    if (error) {
      throw new Error(`Authorization failed: ${error}`);
    }

    if (returnedState !== state) {
      throw new Error("State mismatch. Please rerun `npm run oauth:gmail`.");
    }

    if (!code) {
      throw new Error("Authorization code missing from callback.");
    }

    const tokens = await exchangeCodeForTokens(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      throw new Error(
        "Google did not return a refresh token. Re-run the flow and consent again, or remove the old app grant first."
      );
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderPage("Authorization complete", "Refresh token generated successfully."));

    console.log("");
    console.log("OAuth2 setup completed. Add this to your .env:");
    console.log(`GOOGLE_REFRESH_TOKEN=${refreshToken}`);
    console.log("");
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderPage("Authorization failed", error.message));
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});

server.on("error", (error) => {
  console.error(`OAuth callback server failed: ${error.message}`);
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.search = new URLSearchParams({
    access_type: "offline",
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    login_hint: process.env.GMAIL_USER ?? "",
    prompt: "consent",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://mail.google.com/",
    state
  }).toString();

  console.log("Open this URL in your browser and complete Google sign-in:");
  console.log(authUrl.toString());
  console.log("");
  console.log(`Waiting for OAuth callback on ${redirectUri}`);
});
