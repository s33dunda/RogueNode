# Command Cache POC Implementation Phases

## **Phase 1: Foundation (30 min)**

1. **Add basic cache table to schema**:
   - `commandOutputCache` table with: command, target, gameStateHash, output, timestamp, hitCount
   - Simple index on `["command", "target", "gameStateHash"]`

2. **Create cache utilities**:
   - `generateCacheKey()` - hash command + target + room + health category + threat count
   - `lookupCache()` - exact hash match lookup
   - `storeInCache()` - store new results

## **Phase 2: Integration (30 min)**

3. **Modify ping agent to check cache first**:
   - Before AI generation, check for exact cache hit
   - If found: return cached result + increment hit count
   - If not found: proceed with AI, then store result

## **Phase 3: Validation (15 min)**

4. **Basic cleanup & testing**:
   - Simple TTL cleanup function (delete >24h old entries)
   - Test ping command with same state returns cached result
   - Verify different states generate new results

**Security Note**: Cache maintenance endpoints (cleanup, stats) must be:

- Auth-protected (admin-only access) if exposed as public functions
- OR implemented as internal functions called via cron jobs
- Prevents untrusted clients from deleting cache data or accessing usage statistics

## **Success Criteria**

Same ping command in same game state returns instant cached response on second execution.

## **Scope**

Only ping command, exact matching, 24h TTL. No similarity scoring or complex analytics.
