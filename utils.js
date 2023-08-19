import open, { apps } from "open";
import crypto from "crypto";
import http from "http";
import url from "url";
import fetch from "node-fetch";

const clientId = "";
const access_token = "";
const refresh_token = "";
const PORT = 8888;
const redirectUri = `http://localhost:${PORT}/app/token`;
const SCOPES =
  "playlist-read playlist-read-private playlist-modify-public playlist-modify-private user-library-read user-library-modify";

function generateRandomString(length) {
  let text = "";
  let possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier) {
  function base64encode(string) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(string)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return base64encode(digest);
}

export async function auth(incongnito) {
  if (access_token !== "") return { access_token, refresh_token };
  let codeVerifier = generateRandomString(128);
  let codeChallenge = await generateCodeChallenge(codeVerifier);
  let state = generateRandomString(16);
  var code = "";

  let args = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state: state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  //create a temp server for token
  let server = http.createServer(function (req, res) {
    let q = url.parse(req.url, true).query;
    if (q["code"] !== undefined && q["code"] !== "") {
      code = q["code"];
      // console.log("Got Code: ", code);
    }
    res.end(); //end the response
  });

  var browser = { name: apps.browser };
  if (incongnito) {
    browser = { name: apps.browserPrivate };
  }
  server.listen(PORT);
  await open("https://accounts.spotify.com/authorize?" + args.toString(), {
    app: browser,
  });

  while (code === undefined || code == "") {
    await sleep(3000);
  }

  server.close();
  console.log("Fetching Token");

  let body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  let response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body,
  });

  if (!response.ok) {
    throw new Error("HTTP status " + response.status);
  }

  response = await response.json();
  //console.log(response);
  console.log("Auth Done");

  return {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setInterval(resolve, ms));
}
