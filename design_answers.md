# Design Answers

Responses to the questions raised in design1.md.

## Testing

**Can Claude Code use a headless browser?** Yes. Playwright runs headless by default and works fine from within Claude Code or a bash script. The setup:

1. Install Playwright as a dev dependency (`npm i -D @playwright/test`)
2. Run `npx playwright install chromium` to download the browser binary
3. Write tests that start the dev server, open pages, and assert behavior
4. Claude can run `npm run test:e2e` and read the results

**What can't we test autonomously?**

- **Real multi-user collaboration**: Playwright can open multiple browser contexts in one test, so we *can* simulate two users on the same document. This actually works well.
- **Auth with external providers (OAuth, magic links)**: These require real email delivery or third-party redirects. For the autonomous loop, use a simple email+password auth or token-based system that can be tested locally. If magic links are added later, test the generation/validation logic in unit tests and test the UI flow with a mock.
- **Performance/load testing**: Not practical in the agent loop. Do this manually or with a separate CI job.
- **Mobile/touch interactions**: Playwright supports touch emulation to some degree, but real device testing needs a separate setup.

**Recommendation**: Start with Vitest for unit/integration tests and Playwright for browser tests. Task 001 sets this up. The agent prompt requires tests to pass before committing.

## Where Does the Spec Go?

The spec lives in `spec/`:

- **`spec/FEATURES.md`**: Prioritized feature list. Human-maintained. This is the closest thing to a PRD. It's deliberately lightweight — a list of features grouped by priority with brief descriptions and acceptance criteria.
- **`spec/CONSTRAINTS.md`**: Technical constraints, allowed/forbidden dependencies, architecture principles.
- **Additional specs**: If a feature is complex enough to need detailed design (e.g., the collaboration algorithm), add a file like `spec/collaboration.md`.

**How a human updates it**: Edit the files directly and commit. The agent reads them at the start of each run. No special tooling needed — it's just markdown files in the repo.

**Why not a heavier PRD format?** Because the agent reads the spec every run. The simpler and more direct the spec is, the more reliably the agent will follow it. Bullet points with clear "done when" criteria work better than prose paragraphs for an LLM agent.

## Preventing Cheating

Three layers of defense:

1. **Explicit forbidden dependency list** in both AGENT_PROMPT.md and CONSTRAINTS.md. The agent is told exactly which libraries are off-limits and why.

2. **Package.json auditing**: Periodically review `package.json` for new dependencies. You can also add a git hook or CI check that flags any new dependency additions for human review.

3. **Architectural constraints that force from-scratch work**: The spec says "the document model is yours, rendering is from your model to DOM, input handling translates events to operations on your model." An agent following this architecture can't meaningfully use a library like ProseMirror because the architecture is incompatible — the agent would have to throw away its own model, which contradicts the task system.

**What about indirect cheating?** (e.g., copying algorithms from open-source code verbatim). This is harder to prevent, and honestly less important to prevent. If Claude implements a CRDT by understanding the algorithm and writing the code, that's fine even if the algorithm is well-known. The goal is that the code is *ours* and *understood*, not that it's novel.

**Failure mode to watch for**: Claude might try to use `contenteditable` and let the browser handle everything, effectively using the browser as the "library." The constraints doc addresses this — contenteditable can be used as an input mechanism, but the data model and rendering must be ours.

## Autonomy

### Bootstrap Phase (More Human Involvement)

For the first several runs, you'll want to:
- Watch the logs closely
- Review commits
- Refine the AGENT_PROMPT if the agent is misunderstanding something
- Add initial tasks to `current_tasks/` to seed the work queue
- Flesh out `spec/FEATURES.md` based on what the agent asks about in `blockers/`

### Steady State (Less Human Involvement)

Once the foundations are solid:
- Check in periodically (daily?) to review:
  - New files in `decisions/` — approve or reverse
  - New files in `blockers/` — resolve and remove
  - New commits — spot check quality
  - `current_tasks/` — ensure work is flowing
- Add new features to `spec/FEATURES.md` and new tasks to `current_tasks/` as desired
- The agent generates its own follow-up tasks, so the queue should stay populated

### Guardrails for Long Autonomous Runs

- **The `blockers/` directory is the escape valve.** If the agent hits something it can't resolve, it creates a blocker and moves on. This prevents it from going in circles.
- **`decisions/`** lets the agent make progress without waiting for approval, while still giving you a paper trail to review.
- **The consecutive failure limit** in `run_agent.sh` (default: 3) stops the loop if something is fundamentally broken.
- **Log files** are your post-hoc audit trail. Each run is logged with timestamp and commit hash.

### What Limits Autonomy?

The main bottleneck will be the agent's ability to write good tests and catch its own bugs. If the test suite is strong, the agent can work confidently. If tests are weak, bugs accumulate silently. **Invest heavily in the test infrastructure in the early tasks.**

## Other Considerations

### Git Hygiene
- The agent should make focused commits. The AGENT_PROMPT instructs this.
- Consider a branch-per-task strategy if you want to review work before it hits main. This adds complexity to the agent loop though — the simple approach is committing to main and reviewing after.

### API Rate Limits / Cost
- Each agent run is a full Claude conversation. These are not cheap at scale.
- The cooldown timer in `run_agent.sh` provides a minimum gap between runs.
- Monitor your API usage. A run that produces a small commit still uses significant tokens for reading files and reasoning.

### Context Window
- Claude has a finite context window. Very large files or reading many files will eat into it.
- Keep files modular and reasonably sized. The agent should be able to understand a task without reading the entire codebase.
- The AGENT_PROMPT is read every run — keep it focused.

### VPS Setup
- Install: Node.js (LTS), git, Claude Code CLI, Chromium (for Playwright)
- Clone the repo, run `npm install`, run `npx playwright install chromium`
- Start `run_agent.sh` in a tmux/screen session
- Set up monitoring (even a simple cron that checks if the process is running)

### When to Reset
- If the codebase gets into a bad state, you can always revert to a known-good commit and let the agent pick up from there.
- If the AGENT_PROMPT needs significant changes, update it, commit, and the next run picks up the new version automatically.
