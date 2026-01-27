#!/bin/bash
#
# Apollo 30K - Project Initialization Script
#
# Initializes:
# - GitHub Projects (Kanban boards)
# - Labels for automation
# - Integration health checks
# - State sync verification
#
# Usage: ./scripts/initialize-projects.sh
#
# BlackRoad OS, Inc. - 2026
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Config
REPO_OWNER="${GITHUB_REPOSITORY_OWNER:-BlackRoad-OS}"
REPO_NAME="${GITHUB_REPOSITORY_NAME:-apollo-30k-deployment}"

echo -e "${MAGENTA}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║          Apollo 30K - Project Initialization                 ║${NC}"
echo -e "${MAGENTA}║                  BlackRoad OS, Inc.                          ║${NC}"
echo -e "${MAGENTA}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# -----------------------------------------------------------------------------
# Functions
# -----------------------------------------------------------------------------

log_step() {
    echo -e "${BLUE}▶${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        log_error "GitHub CLI (gh) not found. Please install: https://cli.github.com/"
        exit 1
    fi

    if ! gh auth status &> /dev/null; then
        log_error "GitHub CLI not authenticated. Run: gh auth login"
        exit 1
    fi

    log_success "GitHub CLI authenticated"
}

# -----------------------------------------------------------------------------
# Create Labels
# -----------------------------------------------------------------------------

create_labels() {
    log_step "Creating labels..."

    # Priority labels
    local priority_labels=(
        "P0-critical:FF0000:Production down or security issue"
        "P1-high:FF6B00:Major feature or blocking issue"
        "P2-medium:FFD000:Standard work"
        "P3-low:00FF00:Nice to have or tech debt"
    )

    # Integration labels
    local integration_labels=(
        "integration/cloudflare:F38020:Cloudflare Workers KV D1"
        "integration/railway:7B16FF:Railway containers"
        "integration/digitalocean:0080FF:DigitalOcean droplets"
        "integration/pi:C51A4A:Raspberry Pi network"
        "integration/vercel:000000:Vercel deployments"
        "integration/salesforce:00A1E0:Salesforce CRM"
        "integration/claude:D4A166:Claude API"
        "integration/mobile:9C27B0:iSH Shellfish Pyto Working Copy"
        "integration/github:333333:GitHub Projects Actions"
    )

    # State labels
    local state_labels=(
        "state/synced:00FF00:All systems in sync"
        "state/pending:FFD000:Sync in progress"
        "state/conflict:FF0000:Manual resolution needed"
        "state/error:FF0000:Sync failed"
    )

    # Agent labels
    local agent_labels=(
        "agent/aria:FF1D6C:Aria agent assigned"
        "agent/lucidia:F5A623:Lucidia agent assigned"
        "agent/silas:2979FF:Silas agent assigned"
        "agent/cecilia:9C27B0:Cecilia agent assigned"
        "agent/cadence:00BCD4:Cadence agent assigned"
        "agent/alice:E91E63:Alice agent assigned"
    )

    # Kanban column labels
    local kanban_labels=(
        "kanban/backlog:EEEEEE:Backlog column"
        "kanban/triage:FFE0B2:Needs triage"
        "kanban/ready:C8E6C9:Ready to start"
        "kanban/in-progress:BBDEFB:In progress"
        "kanban/review:E1BEE7:In review"
        "kanban/staging:FFF9C4:In staging"
        "kanban/production:B2DFDB:In production"
    )

    # Combine all labels
    local all_labels=("${priority_labels[@]}" "${integration_labels[@]}" "${state_labels[@]}" "${agent_labels[@]}" "${kanban_labels[@]}")

    for label_def in "${all_labels[@]}"; do
        IFS=':' read -r name color description <<< "$label_def"
        if gh label create "$name" --color "$color" --description "$description" --repo "$REPO_OWNER/$REPO_NAME" 2>/dev/null; then
            log_success "Created label: $name"
        else
            log_warning "Label exists or failed: $name"
        fi
    done
}

# -----------------------------------------------------------------------------
# Create Issue Templates
# -----------------------------------------------------------------------------

create_issue_templates() {
    log_step "Creating issue templates..."

    # Agent task template
    mkdir -p .github/ISSUE_TEMPLATE

    cat > .github/ISSUE_TEMPLATE/agent_task.md << 'EOF'
---
name: Agent Task
about: Create a task for an AI agent
title: '[AGENT] '
labels: 'kanban/backlog'
assignees: ''
---

## Agent Assignment
- [ ] aria
- [ ] lucidia
- [ ] silas
- [ ] cecilia
- [ ] cadence
- [ ] alice

## Priority
- [ ] P0-critical
- [ ] P1-high
- [ ] P2-medium
- [ ] P3-low

## Integration Points
- [ ] Cloudflare
- [ ] Railway
- [ ] DigitalOcean
- [ ] Raspberry Pi
- [ ] Vercel
- [ ] Salesforce
- [ ] Claude API
- [ ] Mobile (iSH/Shellfish/Pyto/Working Copy)

## Task Description
<!-- Describe the task in detail -->

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] SHA-256 hash verified
- [ ] All tests pass

## State Sync
- [ ] GitHub state updated
- [ ] Cloudflare KV synced
- [ ] Salesforce record created

---
SHA256 Hash: <!-- Auto-generated -->
EOF

    # Integration task template
    cat > .github/ISSUE_TEMPLATE/integration_task.md << 'EOF'
---
name: Integration Task
about: Task involving external service integration
title: '[INTEGRATION] '
labels: 'kanban/backlog'
assignees: ''
---

## Target Integration
<!-- Select one or more -->
- [ ] Cloudflare (Workers/KV/D1/Pages)
- [ ] Railway
- [ ] DigitalOcean
- [ ] Vercel
- [ ] Salesforce
- [ ] Claude API
- [ ] GitHub API
- [ ] Raspberry Pi
- [ ] Termius
- [ ] Mobile Apps (iSH/Shellfish/Pyto/Working Copy)

## API Endpoints Involved
| Endpoint | Method | Purpose |
|----------|--------|---------|
| | | |

## Task Description
<!-- Describe the integration work -->

## Pre-requisites
- [ ] API credentials configured
- [ ] Endpoint accessible
- [ ] Rate limits understood

## Testing
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Manual verification completed

## State Sync Requirements
- [ ] Cloudflare KV key: `state:<key>`
- [ ] Salesforce object: `AgentDeployment__c`
- [ ] SHA-256 verification required

---
SHA256 Hash: <!-- Auto-generated -->
EOF

    log_success "Created issue templates"
}

# -----------------------------------------------------------------------------
# Verify Integrations
# -----------------------------------------------------------------------------

verify_integrations() {
    log_step "Verifying integration endpoints..."

    echo ""
    echo "Checking API connectivity..."
    echo ""

    # GitHub API
    if gh api /user &> /dev/null; then
        log_success "GitHub API: Connected"
    else
        log_error "GitHub API: Failed"
    fi

    # Cloudflare API
    if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
        if curl -s -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | grep -q '"success":true'; then
            log_success "Cloudflare API: Connected"
        else
            log_error "Cloudflare API: Failed"
        fi
    else
        log_warning "Cloudflare API: Token not set"
    fi

    # Railway API
    if [ -n "$RAILWAY_API_TOKEN" ]; then
        log_success "Railway API: Token configured"
    else
        log_warning "Railway API: Token not set"
    fi

    # DigitalOcean API
    if [ -n "$DIGITALOCEAN_TOKEN" ]; then
        if curl -s -X GET "https://api.digitalocean.com/v2/account" \
            -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" | grep -q '"account"'; then
            log_success "DigitalOcean API: Connected"
        else
            log_error "DigitalOcean API: Failed"
        fi
    else
        log_warning "DigitalOcean API: Token not set"
    fi

    # Vercel API
    if [ -n "$VERCEL_TOKEN" ]; then
        log_success "Vercel API: Token configured"
    else
        log_warning "Vercel API: Token not set"
    fi

    # Claude API
    if [ -n "$ANTHROPIC_API_KEY" ]; then
        log_success "Claude API: Key configured"
    else
        log_warning "Claude API: Key not set"
    fi

    # Salesforce API
    if [ -n "$SALESFORCE_ACCESS_TOKEN" ]; then
        log_success "Salesforce API: Token configured"
    else
        log_warning "Salesforce API: Token not set"
    fi

    echo ""
}

# -----------------------------------------------------------------------------
# Initialize Dependencies
# -----------------------------------------------------------------------------

init_dependencies() {
    log_step "Installing dependencies..."

    if [ -f "package.json" ]; then
        if command -v pnpm &> /dev/null; then
            pnpm install
            log_success "Dependencies installed with pnpm"
        elif command -v npm &> /dev/null; then
            npm install
            log_success "Dependencies installed with npm"
        else
            log_warning "No package manager found"
        fi
    fi
}

# -----------------------------------------------------------------------------
# Create Initial State
# -----------------------------------------------------------------------------

create_initial_state() {
    log_step "Creating initial state file..."

    mkdir -p .state

    cat > .state/kanban-state.json << 'EOF'
{
  "initialized": true,
  "initDate": "2026-01-27T00:00:00.000Z",
  "boards": {
    "agent-pipeline": {
      "columns": ["Backlog", "Triage", "Ready", "In Progress", "Review", "Staging", "Production"]
    },
    "infrastructure": {
      "columns": ["Railway", "Cloudflare", "DigitalOcean", "Raspberry Pi", "Mobile"]
    },
    "integration-health": {
      "columns": ["Healthy", "Degraded", "Down", "Maintenance"]
    }
  },
  "integrations": {
    "cloudflare": { "status": "pending", "lastCheck": null },
    "railway": { "status": "pending", "lastCheck": null },
    "digitalocean": { "status": "pending", "lastCheck": null },
    "vercel": { "status": "pending", "lastCheck": null },
    "salesforce": { "status": "pending", "lastCheck": null },
    "claude": { "status": "pending", "lastCheck": null },
    "github": { "status": "pending", "lastCheck": null },
    "pi": { "status": "pending", "lastCheck": null },
    "termius": { "status": "pending", "lastCheck": null },
    "ish": { "status": "pending", "lastCheck": null },
    "shellfish": { "status": "pending", "lastCheck": null },
    "workingcopy": { "status": "pending", "lastCheck": null },
    "pyto": { "status": "pending", "lastCheck": null }
  },
  "agents": {
    "aria": { "status": "ready", "tasksCompleted": 0 },
    "lucidia": { "status": "ready", "tasksCompleted": 0 },
    "silas": { "status": "ready", "tasksCompleted": 0 },
    "cecilia": { "status": "ready", "tasksCompleted": 0 },
    "cadence": { "status": "ready", "tasksCompleted": 0 },
    "alice": { "status": "ready", "tasksCompleted": 0 }
  }
}
EOF

    log_success "Created initial state file"
}

# -----------------------------------------------------------------------------
# Print Summary
# -----------------------------------------------------------------------------

print_summary() {
    echo ""
    echo -e "${MAGENTA}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║                 Initialization Complete!                     ║${NC}"
    echo -e "${MAGENTA}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}✓${NC} Labels created"
    echo -e "${GREEN}✓${NC} Issue templates created"
    echo -e "${GREEN}✓${NC} Initial state file created"
    echo -e "${GREEN}✓${NC} Integration checks completed"
    echo ""
    echo "Next steps:"
    echo "  1. Set up GitHub Projects via: gh project create"
    echo "  2. Configure missing API tokens in .env"
    echo "  3. Run: pnpm build && pnpm test"
    echo "  4. Deploy infrastructure: pnpm deploy:infrastructure"
    echo ""
    echo "Documentation:"
    echo "  - Kanban setup: .github/PROJECT_KANBAN.md"
    echo "  - Agent instructions: AGENT_INSTRUCTIONS.md"
    echo "  - Integration config: config/integrations.ts"
    echo "  - Hashing utils: src/utils/hashing.ts"
    echo ""
    echo -e "${MAGENTA}Ready to deploy 30,000 agents!${NC}"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    check_gh_cli
    create_labels
    create_issue_templates
    verify_integrations
    init_dependencies
    create_initial_state
    print_summary
}

# Run main function
main "$@"
