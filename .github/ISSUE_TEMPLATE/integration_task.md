---
name: Integration Task
about: Task involving external service integration
title: '[INTEGRATION] '
labels: 'kanban/backlog'
assignees: ''
---

## Target Integration
<!-- Select one or more -->
- [ ] Cloudflare (Workers/KV/D1/Pages/R2)
- [ ] Railway
- [ ] DigitalOcean
- [ ] Vercel
- [ ] Salesforce
- [ ] Claude API (Anthropic)
- [ ] GitHub API
- [ ] Raspberry Pi Network
- [ ] Termius
- [ ] iSH (iOS Shell)
- [ ] Shellfish (iOS SSH)
- [ ] Working Copy (iOS Git)
- [ ] Pyto (iOS Python)

## API Endpoints Involved

| Service | Endpoint | Method | Purpose |
|---------|----------|--------|---------|
| | | | |

## Task Description
<!-- Describe the integration work in detail -->

## Pre-requisites
- [ ] API credentials configured in `.env`
- [ ] Endpoint accessible (health check passed)
- [ ] Rate limits understood
- [ ] Error handling planned

## Testing Requirements
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Manual verification completed
- [ ] Edge cases covered

## State Sync Requirements
| System | Key/Object | Status |
|--------|-----------|--------|
| Cloudflare KV | `state:<key>` | Pending |
| Salesforce | `AgentDeployment__c` | Pending |
| GitHub | Issue/PR labels | Pending |

## SHA-256 Verification
- [ ] Config hash generated
- [ ] State hash generated
- [ ] Deployment hash generated

## Rollback Plan
<!-- Describe how to rollback if integration fails -->

---
**SHA256 Hash:** _Auto-generated on creation_
