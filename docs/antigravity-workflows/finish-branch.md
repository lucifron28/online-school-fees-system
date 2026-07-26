# Finish Branch Workflow

Use this workflow to finalize, commit, and report on a completed branch.

## Instructions
1. **Run Verification:** Execute the `verify-branch` workflow and ensure all checks pass.
2. **Update Documentation:** Refresh README and architecture docs with changes made in the branch.
3. **Commit Changes:** Stage files and create logical, focused conventional commits.
4. **Final Summary:** Present a detailed summary including:
   - Initial vs final repository state
   - Key decisions made
   - Added files & packages
   - Verification command results & browser screenshot
   - Commit log with short hashes
   - Current limitations & readiness for next branch
5. **Stop:** Do not merge into `main`. Await user direction for next branch.
