/**
 * Centralised environment access. All server secrets live here.
 */
export const env = {
  port: Number(process.env.PORT ?? 3001),
  arduinoCliPath: process.env.ARDUINO_CLI_PATH ?? 'arduino-cli',
  arduinoDataDir: process.env.ARDUINO_DATA_DIR ?? '/tmp/droidvibe-arduino-data',
  arduinoUserDir: process.env.ARDUINO_USER_DIR ?? '/tmp/droidvibe-arduino-user',
  jobDir: process.env.JOB_DIR ?? '/tmp/droidvibe-jobs',
  aiApiKey: process.env.AI_API_KEY ?? '',
  aiModel: process.env.AI_MODEL ?? 'mistral-large-latest',
  aiBaseUrl: process.env.AI_BASE_URL ?? 'https://api.mistral.ai/v1',
  tursoUrl: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN,
  defaultFqbn: 'arduino:avr:uno',
} as const;
