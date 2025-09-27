let envInitialized = false;

function assignParsedVars(parsed: NodeJS.ProcessEnv | undefined) {
  if (!parsed) return;
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value as string;
    }
  }
}

export function ensureEnvLoaded() {
  if (envInitialized) return;
  try {
    const dotenv = require('dotenv');
    const candidates = ['.env.local', '.env.development', '.env'];
    for (const path of candidates) {
      const result = dotenv.config({ path });
      assignParsedVars(result.parsed);
    }
  } catch {
    // ignore – user will see explicit errors when required vars are missing
  }
  envInitialized = true;
}

ensureEnvLoaded();
