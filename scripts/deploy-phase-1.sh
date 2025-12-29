#!/bin/bash
# Deploy Phase 1: 1,000 test agents across all zones

set -e

echo "🚀 Apollo Phase 1 Deployment: 1,000 Test Agents"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Phase 1 distribution
RAILWAY_AGENTS=250
CLOUDFLARE_AGENTS=250
DIGITALOCEAN_AGENTS=250
PI_AGENTS=250

echo -e "${BLUE}📊 Phase 1 Distribution:${NC}"
echo "  Railway: $RAILWAY_AGENTS agents"
echo "  Cloudflare Workers: $CLOUDFLARE_AGENTS agents"
echo "  DigitalOcean: $DIGITALOCEAN_AGENTS agents"
echo "  Raspberry Pi: $PI_AGENTS agents"
echo "  Total: 1,000 agents"
echo ""

echo -e "${BLUE}🚂 Deploying to Railway...${NC}"
./scripts/deploy-railway.sh $RAILWAY_AGENTS

echo -e "${BLUE}☁️  Deploying to Cloudflare Workers...${NC}"
./scripts/deploy-cloudflare.sh $CLOUDFLARE_AGENTS

echo -e "${BLUE}💧 Deploying to DigitalOcean...${NC}"
./scripts/deploy-digitalocean.sh $DIGITALOCEAN_AGENTS

echo -e "${BLUE}🥧 Deploying to Raspberry Pi...${NC}"
./scripts/deploy-pi.sh $PI_AGENTS

echo ""
echo -e "${GREEN}✅ Phase 1 Complete!${NC}"
echo ""
echo "📊 Monitoring:"
echo "  Dashboard: https://agents.blackroad.io"
echo "  Health: curl https://apollo-health.workers.dev/health"
echo "  Metrics: curl https://apollo-health.workers.dev/metrics"
