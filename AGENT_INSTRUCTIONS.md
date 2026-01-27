# Agent Instructions & Todo System

> **For all AI agents working on the Apollo 30K Deployment System**
> Follow these instructions to ensure consistent, high-quality contributions

## Agent Identity

You are working on **Apollo 30K** - a system for deploying 30,000 AI agents across:
- **Railway** (20,000 agents)
- **Cloudflare Workers** (8,000 agents)
- **DigitalOcean** (1,000 agents)
- **Raspberry Pi** (1,000 agents)

Your core identities are: `aria`, `lucidia`, `silas`, `cecilia`, `cadence`, `alice`

---

## Critical Rules

### 1. No Failed Pull Requests

**Before creating a PR, verify:**

- [ ] All tests pass locally
- [ ] TypeScript compiles without errors (`pnpm build`)
- [ ] Linting passes (`pnpm lint`)
- [ ] SHA-256 hashes are generated for state changes
- [ ] Integration endpoints are properly configured
- [ ] No secrets in code (use env variables)
- [ ] PR template is fully completed

```bash
# Pre-PR checklist commands
pnpm test          # Run tests
pnpm build         # Compile TypeScript
pnpm lint          # Check linting
pnpm format        # Format code
```

### 2. State Management Protocol

**GitHub** = Source of truth for code
**Cloudflare KV** = Source of truth for state/details
**Salesforce** = Source of truth for CRM data

```
State Flow:
GitHub Issue Created → Hash Generated → KV State Created → Salesforce Lead Created
     ↓                      ↓                  ↓                    ↓
GitHub PR Merged    → Hash Verified  → KV State Updated → Salesforce Closed Won
```

### 3. SHA-256 Verification Required

All state changes must include SHA-256 hashes:

```typescript
import { sha256, hashStateForSync } from '../src/utils/hashing';

// Hash any state change
const stateHash = hashStateForSync({
  key: 'issue-123',
  value: { status: 'open', assignee: 'aria' },
  source: 'github'
});
```

---

## Todo System

### Creating Todos

Use the todo format in all task planning:

```markdown
## Todo: [Task Name]

- [ ] Step 1: Description
- [ ] Step 2: Description
- [ ] Step 3: Description

### Acceptance Criteria
- Criterion 1
- Criterion 2

### Integration Points
- Endpoint 1
- Endpoint 2
```

### Agent Todo Template

```yaml
agent_todo:
  id: "todo-{sha256-short}"
  agent: "aria|lucidia|silas|cecilia|cadence|alice"
  priority: "P0|P1|P2|P3"

  tasks:
    - name: "Task name"
      status: "pending|in_progress|completed|blocked"
      dependencies: []
      integration: "cloudflare|railway|github|etc"

  verification:
    sha256: "{hash}"
    tests_pass: true
    lint_pass: true
    build_pass: true
```

---

## Integration Checklist

### Before Touching Any Integration

| Service | Check | Command/Action |
|---------|-------|----------------|
| Cloudflare | API Token valid | `curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify"` |
| Railway | Project access | `railway status` |
| DigitalOcean | Token valid | `doctl account get` |
| Vercel | Team access | `vercel whoami` |
| Salesforce | Session valid | Check OAuth token expiry |
| Claude | API Key valid | Test message endpoint |
| GitHub | Token scope | `gh auth status` |
| Raspberry Pi | SSH access | `ssh pi@<host> 'echo ok'` |

### Mobile/Edge Tools

| Tool | Purpose | Sync Method |
|------|---------|-------------|
| **Termius** | SSH management | API sync |
| **iSH** | iOS shell | Working Copy |
| **Shellfish** | iOS SSH/SFTP | Key sync |
| **Working Copy** | iOS Git | Auto-push |
| **Pyto** | iOS Python | iCloud/Files |

---

## Code Standards

### TypeScript Requirements

```typescript
// Always use strict types
import { z } from 'zod';

// Define schemas for all data
const MySchema = z.object({
  id: z.string(),
  status: z.enum(['active', 'inactive']),
});

// Export types
export type MyType = z.infer<typeof MySchema>;

// Validate at boundaries
const validated = MySchema.parse(input);
```

### Error Handling

```typescript
// Always handle errors explicitly
try {
  await riskyOperation();
} catch (error) {
  // Log with context
  console.error('[AgentName] Operation failed:', {
    error: error instanceof Error ? error.message : error,
    context: { /* relevant data */ },
  });

  // Re-throw or handle
  throw new Error(`Failed to complete operation: ${error}`);
}
```

### Commit Messages

Follow conventional commits:

```
feat(agents): add new healing algorithm for Pi network
fix(queue): resolve Redis connection timeout issue
docs(readme): update deployment instructions
chore(deps): upgrade bullmq to v5.0.0
refactor(registry): simplify agent lookup logic
```

---

## Kanban Workflow

### Column Transitions

```
Backlog → Triage → Ready → In Progress → Review → Staging → Production
```

### Automation Rules

1. **Issue Created** → Auto-add to Backlog
2. **Label `approved`** → Move to Ready
3. **PR Created** → Move linked issue to In Progress
4. **PR Approved** → Move to Review
5. **Tests Pass** → Move to Staging
6. **PR Merged** → Move to Production, Close Issue

### Moving Cards Programmatically

```bash
# Using GitHub CLI
gh project item-edit --id <item-id> \
  --field-id <status-field-id> \
  --value "In Progress"
```

---

## API Endpoint Reference

### Core Endpoints

| Service | Endpoint | Purpose |
|---------|----------|---------|
| Cloudflare Workers | `api.cloudflare.com/client/v4` | Agent hosting |
| Cloudflare KV | `api.cloudflare.com/client/v4/.../kv` | State storage |
| Cloudflare D1 | `api.cloudflare.com/client/v4/.../d1` | Agent registry |
| Railway | `backboard.railway.app/graphql/v2` | Container deploy |
| DigitalOcean | `api.digitalocean.com/v2` | Droplet management |
| Vercel | `api.vercel.com` | Dashboard deploy |
| Salesforce | `{instance}.salesforce.com/services` | CRM sync |
| Claude | `api.anthropic.com/v1` | AI inference |
| GitHub | `api.github.com` | Code/project mgmt |

### Health Check Pattern

```typescript
async function checkEndpoint(name: string, url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'GET' });
    console.log(`[Health] ${name}: ${response.ok ? '✓' : '✗'}`);
    return response.ok;
  } catch (error) {
    console.log(`[Health] ${name}: ✗ (${error})`);
    return false;
  }
}
```

---

## Troubleshooting

### Common PR Failures

| Error | Cause | Fix |
|-------|-------|-----|
| `TypeScript error` | Type mismatch | Check types, run `pnpm build` |
| `Lint error` | Code style | Run `pnpm lint --fix` |
| `Test failure` | Logic error | Debug test, check mock data |
| `Build timeout` | Resource issue | Check memory, simplify build |
| `Secret detected` | Leaked credential | Remove secret, rotate key |

### Integration Failures

| Service | Error | Fix |
|---------|-------|-----|
| Cloudflare | `401 Unauthorized` | Refresh API token |
| Railway | `Rate limited` | Wait, reduce requests |
| GitHub | `403 Forbidden` | Check token scopes |
| Salesforce | `Session expired` | Re-authenticate OAuth |

---

## Quick Commands

```bash
# Development
pnpm dev                    # Start dev server
pnpm build                  # Build TypeScript
pnpm test                   # Run tests
pnpm lint                   # Check linting

# Deployment
pnpm deploy:infrastructure  # Deploy base infra
pnpm deploy:phase-1         # Deploy 1,000 agents
pnpm deploy:phase-2         # Deploy 10,000 agents
pnpm deploy:phase-3         # Deploy 30,000 agents

# Monitoring
pnpm monitor               # Start monitoring
pnpm scale                 # Manual scaling

# Git
git status                 # Check changes
git add -p                 # Stage interactively
git commit -m "type: msg"  # Commit
git push -u origin branch  # Push
gh pr create               # Create PR
```

---

## Remember

1. **Quality over speed** - A working PR is better than a fast failed one
2. **Hash everything** - State changes need SHA-256 verification
3. **Test locally first** - Run the full check before pushing
4. **Document integrations** - Note which endpoints you're using
5. **Follow the kanban** - Move cards as you progress
6. **Coordinate with Cece** - Ensure consistency with other repos

---

*Apollo 30K Agent Instructions v1.0*
*BlackRoad OS, Inc. - 2026*
