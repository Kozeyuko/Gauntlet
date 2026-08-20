# TASK — Fix test expectations for v2.1 task/move changes (test-only)

The engine/UI for v2.1 Batch 2 was already implemented (map street-pathfinding via
`computeRoute`, tasks persist instead of being removed, auto button reflects state,
MOVE_ENC_CHANCE lowered to 0.02). These are INTENTIONAL behavior changes. The test
suite still has OLD assertions that expect the previous behavior, and they now fail
(~18 failures). Update the failing tests in `test/harness.mjs` to match the new
intended behavior. Do NOT change engine/ui code — only fix test expectations.

Run `node test/harness.mjs` first to see all failures, then fix each.

## New intended behavior (match tests to this)

1. **Tasks PERSIST** — `doDay()`/`advanceDay()` decrement each task's `n` count but
   do NOT remove items from `TaskList`. The list keeps all entries. When all tasks
   reach `n <= 0` (and not repeating), their counts reset to `origN` (or 1) so they
   can be re-run. Only the X button (`removeTask`) deletes an entry.
   - Tests asserting `TaskList.length` decreases after `doDay` should now assert the
     length stays the same and counts decrement/reset.
   - The `TaskIndex` cursor advances; with Repeat on it cycles.

2. **MOVE_ENC_CHANCE = 0.02** (was 0.15) — update the assertion.

3. Tests that checked "next task is X" after removal now need to check the task at
   the current `TaskIndex` / or that counts decremented.

Update the following test blocks (and any others that fail):
- "Tasklist: doDay advances through entries in order" (already partly rewritten to
  expect persistence — align fully)
- "Tasklist: TaskRepeat cycles the sequence"
- Any test asserting `TaskList.length` decreases, "task consumed", "next task is X",
  "task list empty", "TaskIndex stays at 0 in non-repeat (splice)", "one task
  consumed", "item consumed at n=0", "stopped after 2 days"
- "v2 B4: MOVE_ENC_CHANCE is 0.15" → assert 0.02

Keep ALL other tests passing. The goal is 100% green with the new persistence +
pathing behavior.

## Definition of done
1. `node test/harness.mjs` — ALL tests pass (no failures).
2. `node --check test/harness.mjs` passes.
3. No changes to `js/*` engine/UI code — test file only.
4. Commit with message: "Update test expectations for task persistence, street pathing, and encounter rate".
   Do not push.
