# Automation API Testing Checklist

This document explains how to run the authenticated backend tests without ever touching the browser. It works the same on your laptop, Codex Cloud, or CI: start the dev server, expose it if needed, and hit the APIs with the automation headers.

---

## 1. Required Environment Variables

Add these to your `.env.local` (and to the Codex Cloud environment):

```
CLERK_SECRET_KEY=sk_test_sbwNkxvwJFXfwsheRSj5wpkmdl0NrVdomjzvhqAk3z
CLERK_AUTOMATION_SERVICE_TOKEN=sk_test_sbwNkxvwJFXfwsheRSj5wpkmdl0NrVdomjzvhqAk3z
AUTOMATION_TESTING_SECRET=<choose-a-strong-random-string>
AUTOMATION_USER_ID=user_33neqrnH0OrnbvECgCZF9YT4E7F
AUTOMATION_USER_EMAIL=test-automation@gemz.io
NEXT_PUBLIC_SITE_URL=http://localhost:3002
```

Optional (only when you expose the dev server publicly):
```
AUTOMATION_BASE_URL=https://<your-forwarded-or-tunnel-url>
```

> Set the same values inside Codex Cloud’s environment page. Codex decrypts the secrets on boot and removes the plaintext copies before the agent starts. citedevelopers.openai.com

---

## 2. Run the dev server

```
npm install
npm run dev -- --hostname 0.0.0.0 --port 3002
```

---

## 3. Expose the server (only if external services need it)

### Option A: LocalTunnel (no account needed)
```
npx localtunnel --port 3002 --subdomain youralias
```
Copy the printed HTTPS URL (`https://youralias.loca.lt`) and set:
```
NEXT_PUBLIC_SITE_URL=https://youralias.loca.lt
AUTOMATION_BASE_URL=https://youralias.loca.lt
```

### Option B: Cloudflare quick tunnel (no login)
```
cloudflared tunnel --url http://localhost:3002 --no-autoupdate
```
Again copy the generated `https://...trycloudflare.com` URL and assign it to the same env vars. citedevelopers.cloudflare.com

If you only need to run the script **inside** the container, skip the tunnel and just pass `AUTOMATION_BASE_URL=http://127.0.0.1:3002` when running commands.

---

## 4. Seed the automation user

```
npx tsx scripts/seed-automation-onboarding.ts
```

This ensures `test-automation@gemz.io` has a Glow Up trial, fake Stripe IDs, and zero usage.

---

## 5. Run the automated checks

### Built-in smoke script
```
AUTOMATION_BASE_URL=${AUTOMATION_BASE_URL:-http://127.0.0.1:3002} \
npx tsx scripts/test-backend-flow.ts
```
Expected output (200 status codes) for `/api/onboarding/status` and `/api/usage/summary`.

### Manual curl
```
curl "$AUTOMATION_BASE_URL/api/usage/summary" \
  -H "X-Testing-Token: $AUTOMATION_TESTING_SECRET" \
  -H "X-Automation-User-Id: $AUTOMATION_USER_ID"
```

### Keyword search example
```
# Create campaign
curl "$AUTOMATION_BASE_URL/api/campaigns" \
  -H "X-Testing-Token: $AUTOMATION_TESTING_SECRET" \
  -H "X-Automation-User-Id: $AUTOMATION_USER_ID" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Automation Tunnel Campaign","description":"testing", "searchType":"keyword"}'

# Kick off YouTube scrape (targetResults must be 100/500/1000)
curl "$AUTOMATION_BASE_URL/api/scraping/youtube" \
  -H "X-Testing-Token: $AUTOMATION_TESTING_SECRET" \
  -H "X-Automation-User-Id: $AUTOMATION_USER_ID" \
  -H 'Content-Type: application/json' \
  -d '{"keywords":["automation testing"],"targetResults":100,"campaignId":"<campaign-id>"}'
```

---

## 6. Running in Codex Cloud or CI

1. Mirror the env vars above in the Codex environment settings.
2. Start the dev server (`npm run dev -- --hostname 0.0.0.0 --port 3002`).
3. If the outside world needs access (QStash, teammates, browsers):
   - Start a tunnel inside the container (`localtunnel` or `cloudflared`).
   - Update `NEXT_PUBLIC_SITE_URL` and `AUTOMATION_BASE_URL` with the generated HTTPS hostname.
4. Execute `npx tsx scripts/test-backend-flow.ts` (or your full test suite). Use the tunnel URL when calling from outside the container; use `http://127.0.0.1:3002` when running the script inside the container.

Codex treats each container as an isolated Linux box; once the local process works end-to-end, the same script works remotely with the same env vars. citedevelopers.openai.comcitedevelopers.openai.com

---

## 7. Cleanup

Stop the tunnel when you’re done:
```
pkill localtunnel   # or pkill cloudflared
```

No further cleanup is necessary; the automation secret protects those endpoints everywhere except your development environments.
