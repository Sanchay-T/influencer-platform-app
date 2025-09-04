# Local PostgreSQL Database Setup

This guide helps you set up a local PostgreSQL database for development, keeping all your existing API keys and configurations.

## Quick Setup

### Prerequisites
- Docker Desktop installed and running
- Node.js and npm installed

### 1. Start Local Database
```bash
npm run db:local:setup
```

This will:
- Start PostgreSQL in Docker container
- Run all migrations to create tables
- Verify the setup is working

### 2. Start Development Server
```bash
npm run dev:local
```

The application will now use your local PostgreSQL database instead of Supabase.

## Manual Setup (Alternative)

If you prefer not to use Docker:

### Install PostgreSQL directly
```bash
# macOS with Homebrew
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb influencer_platform_dev

# Set environment
export NODE_ENV=development

# Run migrations
npm run db:push
```

## Database Management Commands

| Command | Description |
|---------|-------------|
| `npm run db:local:up` | Start PostgreSQL container |
| `npm run db:local:down` | Stop PostgreSQL container |
| `npm run db:local:reset` | Reset database (deletes all data) |
| `npm run db:local:test` | Test database connection |
| `npm run db:studio:local` | Open database browser |
| `npm run dev:local` | Start app with local database |

## Connection Details

- **Host**: localhost:5432
- **Database**: influencer_platform_dev
- **Username**: postgres
- **Password**: localdev123

## Environment Files

- `.env.local` - Production/Supabase database
- `.env.development` - Local PostgreSQL database

The app automatically switches based on `NODE_ENV`:
- `NODE_ENV=development` → Uses local database
- `NODE_ENV=production` → Uses Supabase

## Database Schema

The local database has the same schema as production:

- `campaigns` - User campaigns
- `scraping_jobs` - Background processing jobs  
- `scraping_results` - Job results
- `user_profiles` - User data with billing info
- `system_configurations` - App settings
- `events` - Event sourcing for audit trail
- `background_jobs` - QStash job tracking

## Troubleshooting

### Docker not running
```bash
# Check if Docker is running
docker ps

# If not, start Docker Desktop app and wait for it to be ready
```

### Connection issues
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f postgres

# Reset everything
npm run db:local:reset
```

### Migration issues
```bash
# Re-run migrations
NODE_ENV=development npm run db:push

# Check if tables exist
npm run db:local:test
```

## Benefits of Local Development

1. **Fast Development**: No network latency
2. **Safe Testing**: Won't affect production data
3. **Offline Work**: Works without internet
4. **Easy Reset**: Quick database resets for testing
5. **Full Control**: Access to all PostgreSQL tools

## Data Migration

To copy data from production to local (for testing):

```bash
# Export from production (be careful!)
pg_dump "your-production-url" > backup.sql

# Import to local
docker-compose exec -T postgres psql -U postgres -d influencer_platform_dev < backup.sql
```

⚠️ **Never copy production data containing real user information**