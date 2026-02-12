#!/bin/bash

echo "🚀 Setting up local PostgreSQL database for development..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo ""
    echo "❌ Docker is not running. Please:"
    echo "   1. Open Docker Desktop application"
    echo "   2. Wait for it to start (Docker icon in system tray should be running)"
    echo "   3. Run this script again: npm run db:local:setup"
    echo ""
    echo "💡 Alternative: Install PostgreSQL directly:"
    echo "   brew install postgresql@15"
    echo "   brew services start postgresql@15"
    echo "   createdb influencer_platform_dev"
    echo ""
    exit 1
fi

echo "✅ Docker is running"

# Start PostgreSQL container
echo "🐳 Starting PostgreSQL container..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to start..."
sleep 10

# Check if PostgreSQL is ready
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    echo "⏳ Still waiting for PostgreSQL... ($i/30)"
    sleep 2
done

# Run migrations
echo "🔄 Running database migrations..."
NODE_ENV=development npm run db:push

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Local database setup complete!"
    echo ""
    echo "📋 Next steps:"
    echo "   • Start development server: npm run dev:ngrok"
    echo "   • Access database studio: npm run db:studio:local"
    echo "   • View container logs: docker-compose logs -f"
    echo ""
    echo "🔧 Database connection details:"
    echo "   Host: localhost:5432"
    echo "   Database: influencer_platform_dev" 
    echo "   Username: postgres"
    echo "   Password: localdev123"
    echo ""
else
    echo "❌ Migration failed. Check the error above."
    exit 1
fi
