# Apollo 30K Kanban Project System

> **Salesforce-style Project Management in GitHub**
> CRM holds state, Cloudflare holds details, Git has the files

## Project Board Structure

### Board 1: Agent Deployment Pipeline
| Column | Purpose | Automation |
|--------|---------|------------|
| **Backlog** | Incoming requests, ideas | Auto-add from issues |
| **Triage** | Needs review/prioritization | Label-based sorting |
| **Ready** | Approved, ready to start | SHA-256 verified |
| **In Progress** | Active development | Linked PRs |
| **Review** | Awaiting review/QA | Auto-move on PR |
| **Staging** | Testing in staging env | Cloudflare preview |
| **Production** | Deployed to prod | Auto-close issues |

### Board 2: Infrastructure Status
| Column | Purpose | Integration |
|--------|---------|-------------|
| **Railway** | 20,000 agents | Railway API |
| **Cloudflare** | 8,000 agents | CF Workers API |
| **DigitalOcean** | 1,000 agents | DO API |
| **Raspberry Pi** | 1,000 agents | SSH/Termius |
| **Mobile/Edge** | iSH, Shellfish, Pyto | Mobile APIs |

### Board 3: Integration Health
| Column | Purpose | Endpoint |
|--------|---------|----------|
| **Healthy** | All checks passing | /health |
| **Degraded** | Partial issues | /health/degraded |
| **Down** | Service outage | /health/down |
| **Maintenance** | Planned downtime | /health/maintenance |

---

## GitHub Project Setup Commands

```bash
# Create projects via GitHub CLI
gh project create --title "Apollo Agent Pipeline" --org BlackRoad-OS
gh project create --title "Infrastructure Status" --org BlackRoad-OS
gh project create --title "Integration Health" --org BlackRoad-OS

# Add custom fields for Salesforce-style tracking
gh project field-create 1 --name "Priority" --data-type "SINGLE_SELECT" \
  --single-select-options "P0-Critical,P1-High,P2-Medium,P3-Low"

gh project field-create 1 --name "SHA256 Hash" --data-type "TEXT"
gh project field-create 1 --name "Integration" --data-type "SINGLE_SELECT" \
  --single-select-options "Cloudflare,Railway,DigitalOcean,Pi,Vercel,Salesforce,Claude"

gh project field-create 1 --name "State Sync" --data-type "SINGLE_SELECT" \
  --single-select-options "Synced,Pending,Conflict,Error"
```

---

## Salesforce-Style Workflow

### Stage 1: Lead (Issue Created)
```yaml
trigger: issue.created
actions:
  - add_to_project: "Apollo Agent Pipeline"
  - set_column: "Backlog"
  - generate_sha256: true
  - sync_to_cloudflare_kv: true
```

### Stage 2: Qualified (Triaged)
```yaml
trigger: label.added == "approved"
actions:
  - set_column: "Ready"
  - notify_agents: true
  - update_crm_state: "qualified"
```

### Stage 3: Opportunity (PR Created)
```yaml
trigger: pull_request.created
actions:
  - link_to_issue: true
  - set_column: "In Progress"
  - run_sha256_verification: true
  - update_crm_state: "opportunity"
```

### Stage 4: Closed Won (Merged)
```yaml
trigger: pull_request.merged
actions:
  - set_column: "Production"
  - close_linked_issues: true
  - update_crm_state: "closed_won"
  - sync_final_state: true
```

---

## State Sync Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   GitHub Issues/PRs          Cloudflare KV           Git Files │
│   ┌─────────────┐           ┌─────────────┐      ┌───────────┐ │
│   │  Metadata   │◄─────────►│   State     │◄────►│   Code    │ │
│   │  Labels     │   sync    │   Cache     │ hash │   Configs │ │
│   │  Assignees  │           │   Details   │      │   Docs    │ │
│   └─────────────┘           └─────────────┘      └───────────┘ │
│         │                         │                    │       │
│         └────────────┬────────────┴────────────────────┘       │
│                      ▼                                          │
│              ┌─────────────────┐                                │
│              │  SHA-256 Hash   │                                │
│              │  Verification   │                                │
│              └─────────────────┘                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Labels for Kanban Automation

### Priority Labels
- `P0-critical` - Production down, security issue
- `P1-high` - Major feature, blocking issue
- `P2-medium` - Standard work
- `P3-low` - Nice to have, tech debt

### Integration Labels
- `integration/cloudflare` - Cloudflare Workers, KV, D1
- `integration/railway` - Railway containers
- `integration/digitalocean` - DO droplets
- `integration/pi` - Raspberry Pi network
- `integration/vercel` - Vercel deployments
- `integration/salesforce` - Salesforce CRM
- `integration/claude` - Claude API
- `integration/mobile` - iSH, Shellfish, Pyto, Working Copy

### State Labels
- `state/synced` - All systems in sync
- `state/pending` - Sync in progress
- `state/conflict` - Manual resolution needed
- `state/error` - Sync failed

### Agent Labels
- `agent/aria` - Aria agent assigned
- `agent/lucidia` - Lucidia agent assigned
- `agent/silas` - Silas agent assigned
- `agent/cecilia` - Cecilia agent assigned
- `agent/cadence` - Cadence agent assigned
- `agent/alice` - Alice agent assigned

---

## PR Validation Checklist

Before merging, ensure:

- [ ] SHA-256 hash verified
- [ ] All integrations tested
- [ ] State synced to Cloudflare KV
- [ ] Agent instructions updated
- [ ] No secrets in diff
- [ ] Matches other repo standards (Cece's million repos!)

---

## Quick Reference

| Action | Command |
|--------|---------|
| View projects | `gh project list` |
| View board | `gh project view 1 --web` |
| Add issue | `gh project item-add 1 --owner @me --url <issue-url>` |
| Move card | `gh project item-edit --id <id> --field-id <field> --value <column>` |

---

*Part of the Apollo 30K Deployment System*
*BlackRoad OS, Inc. - 2026*
