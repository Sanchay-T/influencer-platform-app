# Gemz Agent Notes

## Canonical Dev Command

Use this single command for local development:

```bash
npm run dev:ngrok
```

Notes:
- There is intentionally no `npm run dev` script in this repo. Use `dev:ngrok`.
- This starts a Next.js dev server on `LOCAL_PORT` (defaults to `3001`) and ensures an ngrok tunnel is up for that port.
- It assumes `ngrok` is installed and authenticated, and uses the permanent domain `usegemz.ngrok.app`.

## Background (macOS/Linux)

If you need it running in the background:

```bash
mkdir -p tmp logs
nohup npm run dev:ngrok > logs/dev-ngrok.log 2>&1 & echo $! > tmp/dev-ngrok.pid
```

Stop it:

```bash
kill $(cat tmp/dev-ngrok.pid)
```
