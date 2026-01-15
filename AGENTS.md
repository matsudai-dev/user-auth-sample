# AGENTS.md

## About this file
This file provides instructions and context for AI agents.
Please reference this before starting any work on this project.

## Code style guidelines
### TypeScript
- Use tabs for indentation
- Use semicolons
### Markdown
- Use 4 spaces for indentation

## Testing instructions
- This project follows Test-Driven Development (TDD) practices
    1. Define the function name and create a stub that returns a placeholder value
    2. Write test code for the function and run the test command to confirm all tests fail
    3. Implement the function
    4. Run the test command to confirm all tests pass
- Place `{filename}.spec.ts` in the same directory as `{filename}.ts`
- Use `./app/utils/html-parser` for DOM parsing in component tests
- `"noUncheckedIndexedAccess": true` is configured in TypeScript, so indexed elements may be `undefined`. In test code that doesn't handle `undefined`, throw an error explicitly

## Working with GitHub
For all GitHub operations (creating issues, pull requests, searching code, etc.), use `gh` command.

### Creating issues
- Use clear, descriptive titles starting with a verb (e.g., "Add", "Fix", "Update")
- Structure the description with:
    - **Context**: Background and motivation
    - **Requirements**: Specific implementation details
    - **Acceptance Criteria**: Testable outcomes
- Reference existing code patterns when relevant
- Apply appropriate labels: `bug`, `enhancement`, `documentation`, `question`, etc.

### Working on an issue
1. Create and checkout a new branch named `feature/#n` from the `main` branch (where `#n` is the issue number)
2. Implement following the TDD practices described above
3. Create a pull request using `gh` command (do not use browser)
    - Example: `gh pr create --title "..." --body "..." --base main --head feature/#n`

### Commit messages
- Use conventional commit format with lowercase prefixes (e.g., "feat:", "fix:", "chore:")
- Keep messages concise - prefer single-line format to reduce overhead
- Common prefixes:
    - `feat:` - New features
    - `fix:` - Bug fixes
    - `chore:` - Maintenance tasks (dependencies, configuration)
    - `docs:` - Documentation changes
    - `test:` - Test additions or modifications
    - `refactor:` - Code refactoring without changing functionality
