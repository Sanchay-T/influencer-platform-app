-- Initialize local PostgreSQL database for development
CREATE DATABASE IF NOT EXISTS influencer_platform_dev;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE influencer_platform_dev TO postgres;