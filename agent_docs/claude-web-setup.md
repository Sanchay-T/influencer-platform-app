# Claude Code Web - Local Development Setup

This document explains how to set up the full development environment in Claude Code on the web, including local PostgreSQL and Next.js dev server.

## Overview

Claude Code web runs in a sandboxed environment with specific network restrictions. By default:
- **HTTP/HTTPS traffic** goes through a security proxy
- **Direct PostgreSQL connections** to external hosts (like Supabase pooler) are blocked
- **Local PostgreSQL 16** is pre-installed but not running

This guide shows how to enable full local development with database and API testing capabilities.

## Quick Start

Run this script to set up everything:

```bash
# 1. Start local PostgreSQL
sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl \
  -D /var/lib/postgresql/16/main \
  -o "-c config_file=/etc/postgresql/16/main/postgresql.conf" \
  -l /tmp/postgres.log start

# 2. Create database and user
sudo -u postgres psql -c "CREATE DATABASE gemz;"
sudo -u postgres psql -c "CREATE USER gemz WITH PASSWORD 'gemz123';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE gemz TO gemz;"
sudo -u postgres psql -c "ALTER DATABASE gemz OWNER TO gemz;"
sudo -u postgres psql -d gemz -c "GRANT ALL ON SCHEMA public TO gemz;"

# 3. Set environment and push schema
export DATABASE_URL="postgresql://gemz:gemz123@localhost:5432/gemz"
yes | npx drizzle-kit push

# 4. Start Next.js (WITHOUT Turbopack - it has API route issues)
npx next dev -p 3002 &
```

## Detailed Setup

### Step 1: Start Local PostgreSQL

PostgreSQL 16 is pre-installed but not running. Start it with:

```bash
sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl \
  -D /var/lib/postgresql/16/main \
  -o "-c config_file=/etc/postgresql/16/main/postgresql.conf" \
  -l /tmp/postgres.log start
```

Verify it's running:
```bash
pg_isready -h localhost
# Output: localhost:5432 - accepting connections
```

### Step 2: Create Application Database

```bash
# Create database
sudo -u postgres psql -c "CREATE DATABASE gemz;"

# Create user with password
sudo -u postgres psql -c "CREATE USER gemz WITH PASSWORD 'gemz123';"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE gemz TO gemz;"
sudo -u postgres psql -c "ALTER DATABASE gemz OWNER TO gemz;"
sudo -u postgres psql -d gemz -c "GRANT ALL ON SCHEMA public TO gemz;"

# Test connection
PGPASSWORD=gemz123 psql -h localhost -U gemz -d gemz -c "SELECT 'Connected!' as status;"
```

### Step 3: Push Database Schema

```bash
export DATABASE_URL="postgresql://gemz:gemz123@localhost:5432/gemz"

# Push schema (auto-accept prompts)
yes | npx drizzle-kit push
```

Verify tables were created:
```bash
PGPASSWORD=gemz123 psql -h localhost -U gemz -d gemz -c "\dt"
```

### Step 4: Start Development Server

**Important:** Use Next.js WITHOUT Turbopack. Turbopack has issues with API routes in this environment.

```bash
export DATABASE_URL="postgresql://gemz:gemz123@localhost:5432/gemz"

# Start WITHOUT turbopack (no --turbo flag)
npx next dev -p 3002 &

# Wait for compilation
sleep 30
```

### Step 5: Test API Endpoints

The middleware requires authentication. Use the bypass header for testing:

```bash
# Health check
curl -H "x-dev-auth: dev-bypass" "http://localhost:3002/api/health"

# Get campaigns
curl -H "x-dev-auth: dev-bypass" "http://localhost:3002/api/campaigns"
```

## Network Configuration

### What Works

| Service | Status | Notes |
|---------|--------|-------|
| Local PostgreSQL | ✅ | `localhost:5432` |
| Next.js dev server | ✅ | Any port (3000, 3002, etc.) |
| Supabase MCP tools | ✅ | `execute_sql`, `list_tables`, etc. |
| HTTP/HTTPS requests | ✅ | Through security proxy |
| External PostgreSQL | ❌ | DNS/TLS blocked |

### Why External PostgreSQL Fails

The sandbox blocks direct TCP connections to external databases:
- DNS resolution fails for `*.pooler.supabase.com`
- TLS certificate verification fails
- Only HTTP/HTTPS traffic goes through the proxy

### MCP Tools Still Work

The Supabase MCP tools use different network paths (Management API over HTTPS), so they work:
```
mcp__supabase__execute_sql  ✅
mcp__supabase__list_tables  ✅
mcp__supabase__apply_migration  ✅
```

## Troubleshooting

### PostgreSQL Won't Start

Check the log:
```bash
cat /tmp/postgres.log
```

Common issues:
- Config file path wrong → Use `-o "-c config_file=/etc/postgresql/16/main/postgresql.conf"`
- Already running → `pg_isready` to check

### API Routes Return 404

1. **Check if using Turbopack** - Run `npx next dev` without `--turbo`
2. **Clear .next cache** - `rm -rf .next && npx next dev -p 3002`
3. **Check middleware** - Some routes need `x-dev-auth: dev-bypass` header

### Database Connection Errors

1. **Check PostgreSQL is running** - `pg_isready -h localhost`
2. **Check DATABASE_URL** - `echo $DATABASE_URL`
3. **Test connection** - `PGPASSWORD=gemz123 psql -h localhost -U gemz -d gemz -c "SELECT 1;"`

## Environment Variables

For the local setup, these are the key variables:

```bash
# Local database (replaces Supabase for local dev)
DATABASE_URL="postgresql://gemz:gemz123@localhost:5432/gemz"

# Auth bypass for testing (already in env)
AUTH_BYPASS_HEADER="x-dev-auth"
AUTH_BYPASS_TOKEN="dev-bypass"
```

## Session Persistence

To persist the database across session restarts, add a SessionStart hook in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/16/main -o \"-c config_file=/etc/postgresql/16/main/postgresql.conf\" -l /tmp/postgres.log start 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

## Summary

1. **Local PostgreSQL** replaces Supabase for dev testing
2. **MCP tools** still work for production Supabase queries
3. **Next.js** must run WITHOUT Turbopack
4. **API testing** requires `x-dev-auth: dev-bypass` header
5. **Full backend testing** is now possible in Claude Code web
