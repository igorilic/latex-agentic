#!/usr/bin/env node
// Overleaf MCP server for latex-agentic.
//
// Zero-dependency Node (>=18) ESM. Speaks the Model Context Protocol over
// stdio by hand: newline-delimited JSON-RPC 2.0 on stdin/stdout, all logging
// to stderr. Two Overleaf transports:
//   * Git bridge  (https://git.overleaf.com/<projectId>, basic auth git:<token>)
//   * Web API     (session cookie overleaf_session2 + CSRF token) — unofficial
//
// Nothing here ever writes a token or cookie value to stdout/stderr; see
// redact() and the credential-helper plumbing in runGit().

import { createInterface } from "node:readline";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const SERVER_NAME = "overleaf";
const SERVER_VERSION = "0.1.0";
const DEFAULT_PROTOCOL = "2025-06-18";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 latex-agentic/0.1.0";

// ---------------------------------------------------------------------------
// stderr logging only — stdout is reserved for JSON-RPC frames.
// ---------------------------------------------------------------------------
function log(...args) {
  try {
    process.stderr.write("[overleaf-mcp] " + args.join(" ") + "\n");
  } catch {
    /* never let logging crash the server */
  }
}

// ---------------------------------------------------------------------------
// Config resolution.
// For each key prefer OVERLEAF_<KEY>, fall back to OVERLEAF_CFG_<KEY>.
// Empty strings and unsubstituted "${...}" placeholders count as UNSET.
// ---------------------------------------------------------------------------
function rawEnv(key) {
  const direct = process.env["OVERLEAF_" + key];
  const cfg = process.env["OVERLEAF_CFG_" + key];
  for (const v of [direct, cfg]) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t === "") continue;
    if (t.startsWith("${")) continue; // unsubstituted plugin placeholder
    return t;
  }
  return undefined;
}

function getConfig() {
  const baseUrlRaw = rawEnv("BASE_URL") || "https://www.overleaf.com";
  const baseUrl = baseUrlRaw.replace(/\/+$/, "");
  const gitToken = rawEnv("GIT_TOKEN");
  let sessionCookie = rawEnv("SESSION_COOKIE");

  // Normalize the cookie: accept either the raw value or a full
  // "overleaf_session2=..." string (optionally with trailing attributes).
  if (sessionCookie) {
    const m = sessionCookie.match(/overleaf_session2=([^;]+)/);
    if (m) sessionCookie = m[1].trim();
    else sessionCookie = sessionCookie.replace(/^overleaf_session2=/, "").trim();
  }

  // Derive the git host.
  let gitUrl = rawEnv("GIT_URL");
  if (!gitUrl) {
    if (/(^|\.)overleaf\.com$/i.test(hostOf(baseUrl))) {
      gitUrl = "https://git.overleaf.com";
    } else {
      gitUrl = baseUrl + "/git";
    }
  }
  gitUrl = gitUrl.replace(/\/+$/, "");

  return { baseUrl, gitUrl, gitToken, sessionCookie };
}

function hostOf(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Secret hygiene — strip token/cookie values out of any text we hand back.
// ---------------------------------------------------------------------------
function redact(text) {
  let s = text == null ? "" : String(text);
  const cfg = getConfig();
  const secrets = [cfg.gitToken, cfg.sessionCookie].filter(Boolean);
  for (const secret of secrets) {
    if (!secret || secret.length < 4) continue;
    s = s.split(secret).join("«redacted»");
  }
  // Defensive patterns in case a secret was URL-embedded or partially shown.
  s = s.replace(/(overleaf_session2=)[^;\s"]+/gi, "$1«redacted»");
  s = s.replace(/(git:)[^@\s/]+(@)/gi, "$1«redacted»$2");
  s = s.replace(/(x-csrf-token[:=]\s*)[^\s"]+/gi, "$1«redacted»");
  s = s.replace(/(password=)[^\s"]+/gi, "$1«redacted»");
  return s;
}

// ---------------------------------------------------------------------------
// JSON-RPC framing.
// ---------------------------------------------------------------------------
function send(obj) {
  try {
    process.stdout.write(JSON.stringify(obj) + "\n");
  } catch (e) {
    log("failed to serialize response:", e && e.message);
  }
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message, data) {
  const err = { code, message };
  if (data !== undefined) err.data = data;
  send({ jsonrpc: "2.0", id: id === undefined ? null : id, error: err });
}

function okText(text) {
  return { content: [{ type: "text", text: redact(text) }] };
}

function errText(text) {
  return { content: [{ type: "text", text: redact(text) }], isError: true };
}

// ---------------------------------------------------------------------------
// HTTP helpers (web transport). Uses global fetch (Node >=18).
// ---------------------------------------------------------------------------
function cookieHeader() {
  const { sessionCookie } = getConfig();
  return sessionCookie ? `overleaf_session2=${sessionCookie}` : "";
}

function baseHeaders(extra = {}) {
  const h = {
    "User-Agent": USER_AGENT,
    Accept: "*/*",
    ...extra,
  };
  const cookie = cookieHeader();
  if (cookie) h.Cookie = cookie;
  return h;
}

async function webFetch(urlPath, opts = {}) {
  const { baseUrl } = getConfig();
  const url = /^https?:\/\//i.test(urlPath) ? urlPath : baseUrl + urlPath;
  const res = await fetch(url, {
    redirect: opts.redirect || "manual",
    method: opts.method || "GET",
    headers: baseHeaders(opts.headers),
    body: opts.body,
  });
  return res;
}

// Refresh the session cookie if the server hands us a new one, and pull the
// CSRF token out of the /project page. Returns { csrf }.
async function fetchCsrf() {
  const res = await webFetch("/project", { redirect: "manual" });
  if (res.status === 302 || res.status === 301) {
    const loc = res.headers.get("location") || "";
    if (/login/i.test(loc)) {
      throw new Error(
        "AUTH: redirected to login (HTTP " +
          res.status +
          "). The session cookie is missing or expired."
      );
    }
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "AUTH: HTTP " + res.status + " from /project — session cookie expired."
    );
  }
  const html = await res.text();
  let csrf;
  const meta = html.match(/<meta\s+name="ol-csrfToken"\s+content="([^"]+)"/i);
  if (meta) csrf = meta[1];
  if (!csrf) {
    const win = html.match(/window\.csrfToken\s*=\s*"([^"]+)"/);
    if (win) csrf = win[1];
  }
  if (!csrf) {
    throw new Error(
      "Could not locate CSRF token on /project — the unofficial web API likely changed. Prefer the git transport."
    );
  }
  return { csrf };
}

function htmlEntityDecode(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x22;/gi, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/")
    .replace(/&amp;/g, "&");
}

function attrContent(html, name) {
  // Handle both attribute orderings of a <meta> tag.
  const re1 = new RegExp(
    '<meta\\s+name="' + name + '"\\s+content="([^"]*)"',
    "i"
  );
  const re2 = new RegExp(
    '<meta\\s+content="([^"]*)"\\s+name="' + name + '"',
    "i"
  );
  const m = html.match(re1) || html.match(re2);
  return m ? m[1] : undefined;
}

function normalizeProject(p) {
  if (!p || typeof p !== "object") return null;
  const id = p.id || p._id || p.projectId;
  if (!id) return null;
  return {
    id: String(id),
    name: p.name || p.title || "(untitled)",
    lastUpdated: p.lastUpdated || p.lastModified || p.updatedAt || null,
    archived: Boolean(p.archived || p.isArchived),
    trashed: Boolean(p.trashed || p.isTrashed),
  };
}

function extractProjects(html) {
  // 1) ol-prefetchedProjectsBlob (HTML-entity-encoded JSON).
  let blob = attrContent(html, "ol-prefetchedProjectsBlob");
  if (blob) {
    try {
      const json = JSON.parse(htmlEntityDecode(blob));
      const arr = Array.isArray(json) ? json : json.projects;
      if (Array.isArray(arr)) {
        const out = arr.map(normalizeProject).filter(Boolean);
        if (out.length || arr.length === 0) return out;
      }
    } catch (e) {
      log("ol-prefetchedProjectsBlob parse failed:", e && e.message);
    }
  }
  // 2) ol-projects.
  blob = attrContent(html, "ol-projects");
  if (blob) {
    try {
      const json = JSON.parse(htmlEntityDecode(blob));
      const arr = Array.isArray(json) ? json : json.projects;
      if (Array.isArray(arr)) {
        const out = arr.map(normalizeProject).filter(Boolean);
        if (out.length || arr.length === 0) return out;
      }
    } catch (e) {
      log("ol-projects parse failed:", e && e.message);
    }
  }
  // 3) Embedded JSON regex fallback.
  const m = html.match(/"projects"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
  if (m) {
    try {
      const arr = JSON.parse(htmlEntityDecode(m[1]));
      if (Array.isArray(arr)) {
        return arr.map(normalizeProject).filter(Boolean);
      }
    } catch (e) {
      log("embedded projects regex parse failed:", e && e.message);
    }
  }
  return null; // signal "extraction failed"
}

// ---------------------------------------------------------------------------
// Git helpers (git transport). Token is passed via env to a credential helper
// so it never appears in argv or .git/config.
// ---------------------------------------------------------------------------
function runGit(args, { cwd, token } = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    const credArgs = [];
    if (token) {
      env.OVERLEAF_GIT_TOKEN = token;
      credArgs.push(
        "-c",
        "credential.helper=",
        "-c",
        "credential.helper=!f(){ echo username=git; echo \"password=$OVERLEAF_GIT_TOKEN\"; }; f"
      );
    }
    // Never prompt interactively for credentials.
    env.GIT_TERMINAL_PROMPT = "0";
    const fullArgs = [...credArgs, ...args];
    execFile(
      "git",
      fullArgs,
      { cwd, env, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          code: error ? (typeof error.code === "number" ? error.code : 1) : 0,
          stdout: stdout || "",
          stderr: stderr || "",
          error,
        });
      }
    );
  });
}

function remoteUrl(projectId) {
  const { gitUrl } = getConfig();
  return `${gitUrl}/${projectId}`;
}

function tail(text, n) {
  const lines = String(text || "").split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - n)).join("\n");
}

// ---------------------------------------------------------------------------
// .latex-agentic.json read-modify-write for overleaf_link.
// ---------------------------------------------------------------------------
async function mergeContract(dir, overleafBlock) {
  const file = path.join(dir, ".latex-agentic.json");
  let current = {};
  try {
    const raw = await fs.readFile(file, "utf8");
    current = JSON.parse(raw);
    if (current == null || typeof current !== "object") current = {};
  } catch (e) {
    if (e && e.code !== "ENOENT") {
      log("contract read warning:", e.message);
    }
    current = {};
  }
  current.overleaf = { ...(current.overleaf || {}), ...overleafBlock };
  await fs.writeFile(file, JSON.stringify(current, null, 2) + "\n", "utf8");
  return file;
}

// ---------------------------------------------------------------------------
// Tool definitions.
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    name: "overleaf_status",
    description:
      "Report which Overleaf transports are configured (booleans only; never reveals secret values), plus the base and git URLs.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "overleaf_list_projects",
    description:
      "List your Overleaf projects (web transport). Returns id, name, lastUpdated and archived/trashed flags.",
    inputSchema: {
      type: "object",
      properties: {
        includeArchived: {
          type: "boolean",
          description: "Include archived/trashed projects in the list.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "overleaf_create_project",
    description:
      "Create a new blank Overleaf project (web transport) and return its id and URL.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Project name." },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "overleaf_delete_project",
    description:
      "Trash an Overleaf project (web transport). Requires confirm:true. With hard:true also permanently deletes it.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Overleaf project id." },
        confirm: {
          type: "boolean",
          description: "Must be true to proceed; a safety gate.",
        },
        hard: {
          type: "boolean",
          description: "Permanently delete in addition to trashing.",
        },
      },
      required: ["projectId", "confirm"],
      additionalProperties: false,
    },
  },
  {
    name: "overleaf_download_project",
    description:
      "Download an Overleaf project as a zip (web transport) and extract it into a local directory; returns the extracted file list.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Overleaf project id." },
        dir: { type: "string", description: "Local directory to extract into." },
      },
      required: ["projectId", "dir"],
      additionalProperties: false,
    },
  },
  {
    name: "overleaf_compile",
    description:
      "Trigger a server-side compile of an Overleaf project (web transport) and report status plus a tail of output.log if available.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Overleaf project id." },
      },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "overleaf_clone",
    description:
      "Clone an Overleaf project into a local directory using the git bridge (git transport).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Overleaf project id." },
        dir: { type: "string", description: "Local directory to clone into." },
      },
      required: ["projectId", "dir"],
      additionalProperties: false,
    },
  },
  {
    name: "overleaf_pull",
    description:
      "Pull remote Overleaf changes into a local clone (git transport, pull --rebase).",
    inputSchema: {
      type: "object",
      properties: {
        dir: { type: "string", description: "Local git working directory." },
      },
      required: ["dir"],
      additionalProperties: false,
    },
  },
  {
    name: "overleaf_push",
    description:
      "Commit local changes and push them to Overleaf (git transport). Skips cleanly when there is nothing to commit.",
    inputSchema: {
      type: "object",
      properties: {
        dir: { type: "string", description: "Local git working directory." },
        message: {
          type: "string",
          description: "Commit message (default: a timestamped message).",
        },
      },
      required: ["dir"],
      additionalProperties: false,
    },
  },
  {
    name: "overleaf_link",
    description:
      "Record the Overleaf project link in the project's .latex-agentic.json (read-modify-write, preserving other keys).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Overleaf project id." },
        dir: {
          type: "string",
          description: "Project directory containing .latex-agentic.json.",
        },
        transport: {
          type: "string",
          enum: ["git", "web"],
          description: "Preferred transport for this project (default git).",
        },
      },
      required: ["projectId", "dir"],
      additionalProperties: false,
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers. Each is async and wrapped in try/catch by the dispatcher.
// ---------------------------------------------------------------------------
const handlers = {
  async overleaf_status() {
    const cfg = getConfig();
    const status = {
      transports: {
        web: Boolean(cfg.sessionCookie),
        git: Boolean(cfg.gitToken),
      },
      baseUrl: cfg.baseUrl,
      gitUrl: cfg.gitUrl,
      notes: [],
    };
    if (!status.transports.web)
      status.notes.push(
        "Web transport unconfigured: set OVERLEAF_SESSION_COOKIE for list/create/delete/download/compile."
      );
    if (!status.transports.git)
      status.notes.push(
        "Git transport unconfigured: set OVERLEAF_GIT_TOKEN for clone/pull/push."
      );
    return okText(JSON.stringify(status, null, 2));
  },

  async overleaf_list_projects(args = {}) {
    const cfg = getConfig();
    if (!cfg.sessionCookie)
      return errText(
        "Web transport not configured: set OVERLEAF_SESSION_COOKIE (overleaf_session2)."
      );
    const res = await webFetch("/project", { redirect: "manual" });
    if (res.status === 302 || res.status === 301) {
      const loc = res.headers.get("location") || "";
      if (/login/i.test(loc))
        return errText(
          "HTTP " +
            res.status +
            ": redirected to login — the session cookie is missing or expired (401-equivalent)."
        );
    }
    if (res.status === 401 || res.status === 403)
      return errText(
        "HTTP " + res.status + ": session cookie expired or invalid."
      );
    if (!res.ok && res.status !== 200)
      return errText("HTTP " + res.status + " fetching /project.");
    const html = await res.text();
    let projects = extractProjects(html);
    if (projects == null)
      return errText(
        "Could not extract the project list from /project HTML. The unofficial Overleaf web API likely changed. " +
          "Use the git transport (overleaf_clone) instead, which is stable."
      );
    if (!args.includeArchived)
      projects = projects.filter((p) => !p.archived && !p.trashed);
    return okText(
      JSON.stringify({ count: projects.length, projects }, null, 2)
    );
  },

  async overleaf_create_project(args = {}) {
    const cfg = getConfig();
    if (!cfg.sessionCookie)
      return errText(
        "Web transport not configured: set OVERLEAF_SESSION_COOKIE."
      );
    if (!args.name || typeof args.name !== "string")
      return errText("Missing required argument: name (string).");
    const { csrf } = await fetchCsrf();
    const payload = JSON.stringify({
      _csrf: csrf,
      projectName: args.name,
      template: "none",
    });
    const headers = {
      "Content-Type": "application/json",
      "x-csrf-token": csrf,
      Accept: "application/json",
    };
    let res = await webFetch("/project/new", {
      method: "POST",
      headers,
      body: payload,
      redirect: "manual",
    });
    if (res.status === 404) {
      res = await webFetch("/api/project/new", {
        method: "POST",
        headers,
        body: payload,
        redirect: "manual",
      });
    }
    const text = await res.text();
    if (res.status === 401 || res.status === 403)
      return errText("HTTP " + res.status + ": session cookie expired.");
    if (!res.ok)
      return errText(
        "HTTP " + res.status + " creating project: " + tail(text, 5)
      );
    let id;
    try {
      const json = JSON.parse(text);
      id = json.project_id || json.projectId || (json.project && json.project._id) || json._id;
    } catch {
      const m = text.match(/[0-9a-f]{24}/i);
      if (m) id = m[0];
    }
    if (!id)
      return errText(
        "Project create returned no recognizable id. Response head: " +
          tail(text, 5)
      );
    return okText(
      JSON.stringify(
        {
          created: true,
          projectId: String(id),
          url: `${cfg.baseUrl}/project/${id}`,
        },
        null,
        2
      )
    );
  },

  async overleaf_delete_project(args = {}) {
    const cfg = getConfig();
    if (!cfg.sessionCookie)
      return errText(
        "Web transport not configured: set OVERLEAF_SESSION_COOKIE."
      );
    if (!args.projectId) return errText("Missing required argument: projectId.");
    if (args.confirm !== true)
      return errText(
        "Refusing to delete: pass confirm:true to acknowledge this is destructive."
      );
    const { csrf } = await fetchCsrf();
    const headers = { "x-csrf-token": csrf, Accept: "application/json" };
    const id = encodeURIComponent(args.projectId);
    const steps = [];

    const trash = await webFetch(`/project/${id}/trash`, {
      method: "POST",
      headers,
      redirect: "manual",
    });
    steps.push({ action: "trash", status: trash.status, ok: trash.ok || trash.status === 204 });
    if (trash.status === 401 || trash.status === 403)
      return errText("HTTP " + trash.status + ": session cookie expired.");

    if (args.hard === true) {
      const del = await webFetch(`/project/${id}`, {
        method: "DELETE",
        headers,
        redirect: "manual",
      });
      steps.push({
        action: "delete",
        status: del.status,
        ok: del.ok || del.status === 204,
      });
    }
    const anyFail = steps.some((s) => !s.ok);
    const result = { projectId: args.projectId, hard: args.hard === true, steps };
    return anyFail
      ? errText(
          "One or more delete steps failed:\n" + JSON.stringify(result, null, 2)
        )
      : okText(JSON.stringify(result, null, 2));
  },

  async overleaf_download_project(args = {}) {
    const cfg = getConfig();
    if (!cfg.sessionCookie)
      return errText(
        "Web transport not configured: set OVERLEAF_SESSION_COOKIE."
      );
    if (!args.projectId) return errText("Missing required argument: projectId.");
    if (!args.dir) return errText("Missing required argument: dir.");
    const id = encodeURIComponent(args.projectId);
    const res = await webFetch(`/project/${id}/download/zip`, {
      redirect: "manual",
    });
    if (res.status === 302 || res.status === 301)
      return errText(
        "HTTP " +
          res.status +
          ": redirected (likely to login) — session cookie expired."
      );
    if (res.status === 401 || res.status === 403)
      return errText("HTTP " + res.status + ": session cookie expired.");
    if (!res.ok)
      return errText("HTTP " + res.status + " downloading project zip.");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return errText("Downloaded zip was empty.");
    const tmp = path.join(
      os.tmpdir(),
      `overleaf-${args.projectId}-${Date.now()}.zip`
    );
    await fs.writeFile(tmp, buf);
    await fs.mkdir(args.dir, { recursive: true });
    const unzip = await new Promise((resolve) => {
      execFile(
        "unzip",
        ["-o", "-q", tmp, "-d", args.dir],
        { maxBuffer: 8 * 1024 * 1024 },
        (error, stdout, stderr) =>
          resolve({ error, stdout: stdout || "", stderr: stderr || "" })
      );
    });
    try {
      await fs.unlink(tmp);
    } catch {
      /* best effort */
    }
    if (unzip.error)
      return errText(
        "unzip failed: " + (unzip.stderr || unzip.error.message || "unknown")
      );
    let files = [];
    try {
      files = await listFilesRecursive(args.dir);
    } catch (e) {
      log("post-extract listing failed:", e && e.message);
    }
    return okText(
      JSON.stringify(
        {
          projectId: args.projectId,
          dir: args.dir,
          extractedFiles: files,
          fileCount: files.length,
        },
        null,
        2
      )
    );
  },

  async overleaf_compile(args = {}) {
    const cfg = getConfig();
    if (!cfg.sessionCookie)
      return errText(
        "Web transport not configured: set OVERLEAF_SESSION_COOKIE."
      );
    if (!args.projectId) return errText("Missing required argument: projectId.");
    const { csrf } = await fetchCsrf();
    const id = encodeURIComponent(args.projectId);
    const res = await webFetch(`/project/${id}/compile?auto_compile=true`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
        Accept: "application/json",
      },
      body: JSON.stringify({
        check: "silent",
        draft: false,
        incrementalCompileEnabled: true,
      }),
      redirect: "manual",
    });
    if (res.status === 401 || res.status === 403)
      return errText("HTTP " + res.status + ": session cookie expired.");
    const text = await res.text();
    if (!res.ok)
      return errText(
        "HTTP " + res.status + " triggering compile: " + tail(text, 5)
      );
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return errText("Compile returned non-JSON response: " + tail(text, 5));
    }
    const summary = {
      status: json.status || "unknown",
      compileGroup: json.compileGroup,
      outputFilesCount: Array.isArray(json.outputFiles)
        ? json.outputFiles.length
        : 0,
    };
    // Try to fetch output.log for a tail.
    let logTail = null;
    try {
      const logFile = (json.outputFiles || []).find(
        (f) => f && (f.path === "output.log" || /output\.log$/.test(f.path || ""))
      );
      if (logFile && logFile.url) {
        const logRes = await webFetch(logFile.url, { redirect: "manual" });
        if (logRes.ok) {
          const logText = await logRes.text();
          const lines = logText.split(/\r?\n/);
          logTail = {
            first30: lines.slice(0, 30).join("\n"),
            last30: lines.slice(Math.max(0, lines.length - 30)).join("\n"),
          };
        }
      }
    } catch (e) {
      log("output.log fetch failed:", e && e.message);
    }
    return okText(
      JSON.stringify({ ...summary, log: logTail }, null, 2)
    );
  },

  async overleaf_clone(args = {}) {
    const cfg = getConfig();
    if (!cfg.gitToken)
      return errText(
        "Git transport not configured: set OVERLEAF_GIT_TOKEN (Account Settings → Git Integration)."
      );
    if (!args.projectId) return errText("Missing required argument: projectId.");
    if (!args.dir) return errText("Missing required argument: dir.");
    const url = remoteUrl(args.projectId);
    const r = await runGit(["clone", url, args.dir], { token: cfg.gitToken });
    if (r.code !== 0)
      return errText(
        "git clone failed (exit " +
          r.code +
          "):\n" +
          tail(r.stderr, 15) +
          "\nHint: verify OVERLEAF_GIT_TOKEN is valid and the project id is correct."
      );
    return okText(
      JSON.stringify(
        { cloned: true, projectId: args.projectId, dir: args.dir },
        null,
        2
      )
    );
  },

  async overleaf_pull(args = {}) {
    const cfg = getConfig();
    if (!cfg.gitToken)
      return errText("Git transport not configured: set OVERLEAF_GIT_TOKEN.");
    if (!args.dir) return errText("Missing required argument: dir.");
    const r = await runGit(["pull", "--rebase"], {
      cwd: args.dir,
      token: cfg.gitToken,
    });
    if (r.code !== 0)
      return errText(
        "git pull --rebase failed (exit " +
          r.code +
          "):\n" +
          tail(r.stderr, 15) +
          "\nHint: check OVERLEAF_GIT_TOKEN validity and that this dir is an Overleaf clone."
      );
    return okText(
      JSON.stringify(
        { pulled: true, dir: args.dir, output: tail(r.stdout, 10) },
        null,
        2
      )
    );
  },

  async overleaf_push(args = {}) {
    const cfg = getConfig();
    if (!cfg.gitToken)
      return errText("Git transport not configured: set OVERLEAF_GIT_TOKEN.");
    if (!args.dir) return errText("Missing required argument: dir.");
    const cwd = args.dir;
    const message =
      args.message && String(args.message).trim()
        ? String(args.message)
        : "latex-agentic sync " + new Date().toISOString();

    const add = await runGit(["add", "-A"], { cwd, token: cfg.gitToken });
    if (add.code !== 0)
      return errText("git add -A failed:\n" + tail(add.stderr, 15));

    // Detect whether there is anything staged to commit.
    const status = await runGit(["status", "--porcelain"], {
      cwd,
      token: cfg.gitToken,
    });
    const nothingToCommit = status.code === 0 && status.stdout.trim() === "";

    let committed = false;
    if (!nothingToCommit) {
      const commit = await runGit(["commit", "-m", message], {
        cwd,
        token: cfg.gitToken,
      });
      if (commit.code !== 0) {
        // Could still be a benign "nothing to commit" race.
        if (/nothing to commit/i.test(commit.stdout + commit.stderr)) {
          committed = false;
        } else {
          return errText("git commit failed:\n" + tail(commit.stderr || commit.stdout, 15));
        }
      } else {
        committed = true;
      }
    }

    const push = await runGit(["push"], { cwd, token: cfg.gitToken });
    if (push.code !== 0)
      return errText(
        "git push failed (exit " +
          push.code +
          "):\n" +
          tail(push.stderr, 15) +
          "\nHint: verify OVERLEAF_GIT_TOKEN is valid and has not been revoked."
      );

    return okText(
      JSON.stringify(
        {
          pushed: true,
          committed,
          dir: cwd,
          message: committed ? message : null,
          note: committed ? undefined : "Nothing new to commit; pushed current HEAD.",
          output: tail(push.stderr || push.stdout, 10),
        },
        null,
        2
      )
    );
  },

  async overleaf_link(args = {}) {
    if (!args.projectId) return errText("Missing required argument: projectId.");
    if (!args.dir) return errText("Missing required argument: dir.");
    const transport = args.transport === "web" ? "web" : "git";
    const cfg = getConfig();
    const block = {
      projectId: String(args.projectId),
      transport,
      baseUrl: cfg.baseUrl,
    };
    const file = await mergeContract(args.dir, block);
    return okText(
      JSON.stringify(
        { linked: true, file, overleaf: block },
        null,
        2
      )
    );
  },
};

async function listFilesRecursive(root, base = root) {
  const out = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(root, e.name);
    if (e.isDirectory()) {
      const sub = await listFilesRecursive(full, base);
      out.push(...sub);
    } else {
      out.push(path.relative(base, full));
    }
  }
  return out.sort();
}

// ---------------------------------------------------------------------------
// Method dispatch.
// ---------------------------------------------------------------------------
async function handleRequest(msg) {
  const { id, method, params } = msg;

  // Notifications have no id; never reply to them.
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize": {
      const protocolVersion =
        (params && params.protocolVersion) || DEFAULT_PROTOCOL;
      sendResult(id, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });
      return;
    }
    case "notifications/initialized":
      // no-op notification
      return;
    case "ping":
      sendResult(id, {});
      return;
    case "tools/list":
      sendResult(id, { tools: TOOLS });
      return;
    case "tools/call": {
      const name = params && params.name;
      const args = (params && params.arguments) || {};
      const handler = handlers[name];
      if (!handler) {
        sendResult(id, errText(`Unknown tool: ${name}`));
        return;
      }
      try {
        const result = await handler(args);
        sendResult(id, result);
      } catch (e) {
        const detail = e && e.message ? e.message : String(e);
        sendResult(id, errText(`Tool ${name} failed: ${detail}`));
      }
      return;
    }
    default:
      if (isNotification) {
        // Unknown notification — ignore per JSON-RPC.
        log("ignoring unknown notification:", method);
        return;
      }
      sendError(id, -32601, `Method not found: ${method}`);
      return;
  }
}

// ---------------------------------------------------------------------------
// stdin loop — newline-delimited JSON. Never crash on a bad line.
// ---------------------------------------------------------------------------
function main() {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

  // Track in-flight async handlers so we don't exit on stdin close while a
  // tool call is still mid-flight (which would drop its response / file write).
  let inFlight = 0;
  let stdinClosed = false;
  const maybeExit = () => {
    if (stdinClosed && inFlight === 0) process.exit(0);
  };

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (trimmed === "") return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      log("unparseable line, sending parse error");
      sendError(null, -32700, "Parse error");
      return;
    }
    if (msg == null || typeof msg !== "object" || Array.isArray(msg)) {
      sendError(null, -32600, "Invalid Request");
      return;
    }
    // Run async without unhandled rejections taking down the process.
    inFlight++;
    handleRequest(msg)
      .catch((e) => {
        log("handler crashed:", e && e.message);
        if (msg.id !== undefined && msg.id !== null) {
          sendError(msg.id, -32603, "Internal error");
        }
      })
      .finally(() => {
        inFlight--;
        maybeExit();
      });
  });
  rl.on("close", () => {
    stdinClosed = true;
    maybeExit();
  });
}

process.on("uncaughtException", (e) => {
  log("uncaughtException:", e && e.message);
});
process.on("unhandledRejection", (e) => {
  log("unhandledRejection:", e && (e.message || e));
});

main();
