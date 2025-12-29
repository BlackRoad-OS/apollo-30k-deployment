#!/bin/bash
# Deploy Apollo infrastructure (D1, KV, Workers, etc.)

set -e

echo "🚀 Deploying Apollo 30k Agent Infrastructure..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check for required tools
command -v wrangler >/dev/null 2>&1 || { echo "❌ wrangler not found. Install with: npm install -g wrangler"; exit 1; }

echo -e "${BLUE}📦 Step 1: Creating D1 Database${NC}"
wrangler d1 create apollo-agent-registry || echo "Database may already exist"

echo -e "${BLUE}📦 Step 2: Creating KV Namespaces${NC}"
wrangler kv:namespace create "AGENTS_KV" || echo "KV namespace may already exist"
wrangler kv:namespace create "HEALTH_KV" || echo "KV namespace may already exist"

echo -e "${BLUE}📦 Step 3: Running D1 Migrations${NC}"
wrangler d1 execute apollo-agent-registry --file=./config/schema.sql

echo -e "${BLUE}📦 Step 4: Deploying Health Monitor Worker${NC}"
cd src/monitoring
wrangler deploy

echo -e "${BLUE}📦 Step 5: Setting up Cron Trigger${NC}"
echo "Health checks will run every 30 seconds"

echo -e "${GREEN}✅ Infrastructure deployed successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Update wrangler.toml with database/KV IDs"
echo "  2. Run: ./scripts/deploy-phase-1.sh"
echo "  3. Monitor: https://agents.blackroad.io"
