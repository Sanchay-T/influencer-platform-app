---
description: Stop ngrok tunnel and development server
argument-hint:
allowed-tools: Bash(node:*/stop-ngrok*.js*), Bash(killall*), Bash(lsof*)
---

# Stop Ngrok and Dev Server

Stop the ngrok tunnel and Next.js development server. Cleans up all running processes.

## Arguments

None required.

## Execution

Run the stop script:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/stop-ngrok.js
```

## Output Analysis

Report:

1. **Processes Stopped**:
   - Ngrok tunnel closed
   - Next.js dev server stopped
   - Related processes terminated

2. **Cleanup Actions**:
   - Port 3000 freed
   - Ngrok port freed
   - Tunnel disconnected

3. **Verification**:
   - No processes listening on port 3000
   - Ngrok no longer running
   - Clean shutdown confirmed

## Example Usage

```
/dev/stop-ngrok
```

## Manual Cleanup

If script fails, manually stop processes:

```bash
# Kill Next.js dev server
lsof -ti:3000 | xargs kill -9

# Kill ngrok
killall ngrok

# Verify nothing running
lsof -i:3000
```

## Common Issues

### Issue 1: Processes Won't Stop
**Solution**: Use force kill: `killall -9 node ngrok`

### Issue 2: Port Still In Use
**Solution**: Identify process: `lsof -i:3000` and kill manually

### Issue 3: Multiple Node Processes
**Solution**: Kill all: `killall node` (caution: stops ALL node processes)

## When To Use

- After finishing webhook testing
- Before starting new dev session
- Cleaning up stuck processes
- Switching between projects
- Freeing up ports

## Related Commands

- `/dev/ngrok` - Start ngrok and dev server
- `/dev/check-env` - Verify environment setup
