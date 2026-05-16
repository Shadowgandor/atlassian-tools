import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { AtlassianConfig } from "./types.js";

function detectProfilePath(): string {
  const shell = process.env.SHELL ?? "";
  const home = homedir();

  if (shell.endsWith("zsh")) return join(home, ".zshrc");
  if (shell.endsWith("fish")) return join(home, ".config/fish/config.fish");
  if (shell.endsWith("bash")) {
    const bashProfile = join(home, ".bash_profile");
    return existsSync(bashProfile) ? bashProfile : join(home, ".bashrc");
  }
  return join(home, ".profile");
}

export function loadConfigFromEnv(): AtlassianConfig {
  const baseUrl =
    process.env.ATLASSIAN_URL ??
    process.env.CONFLUENCE_URL?.replace(/\/wiki\/?$/, "");
  const email = process.env.ATLASSIAN_EMAIL ?? process.env.CONFLUENCE_EMAIL;
  const token = process.env.ATLASSIAN_TOKEN ?? process.env.CONFLUENCE_TOKEN;

  const missing: string[] = [];
  if (!baseUrl) missing.push("ATLASSIAN_URL");
  if (!email) missing.push("ATLASSIAN_EMAIL");
  if (!token) missing.push("ATLASSIAN_TOKEN");

  if (missing.length === 0) {
    return { baseUrl: baseUrl!, email: email!, token: token! };
  }

  const label = missing.length === 1 ? "variable" : "variables";

  const status = [
    `  ATLASSIAN_URL   = ${baseUrl ?? "(not set)"}`,
    `  ATLASSIAN_EMAIL = ${email ?? "(not set)"}`,
    `  ATLASSIAN_TOKEN = ${token ? "(set)" : "(not set)"}`,
  ].join("\n");

  const exports = [
    ...(!baseUrl ? [`  export ATLASSIAN_URL="https://your-instance.atlassian.net"`] : []),
    ...(!email   ? [`  export ATLASSIAN_EMAIL="you@example.com"`] : []),
    ...(!token   ? [`  export ATLASSIAN_TOKEN="your-api-token"`] : []),
  ].join("\n");

  throw new Error(
    `Missing required environment ${label}: ${missing.join(", ")}\n\n` +
    `${status}\n\n` +
    `Add the following to ${detectProfilePath()}:\n\n` +
    `${exports}\n\n` +
    `Generate a token at: https://id.atlassian.com/manage-profile/security/api-tokens`,
  );
}
