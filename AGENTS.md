# AGENTS.md

## About this file
This file provides instructions and context for AI agents.
Please reference this before starting any work on this project.

## Project overview
This is a user authentication sample application with the following features:
- User signup/login with email and password
- Multi-factor authentication (MFA) support: TOTP and Email OTP
- Password reset
- Email change
- Session management
- Account deletion

### Tech stack
- **Framework**: Hono + HonoX (Vite-based)
- **Runtime**: Bun (for development and testing)
- **Deployment**: Cloudflare Workers
- **Database**: Cloudflare D1 with Drizzle ORM
- **Styling**: Tailwind CSS v4
- **Email**: Resend
- **Validation**: Zod
- **Testing**: Bun test

### Available commands
- `bun run biome` - Run Biome linter/formatter
- `bun run tsc` - Run TypeScript type checker
- `bun run test` - Run unit tests
- `bun run check` - Run all checks (biome, tsc, test)
- `bun run dev` - Start development server ( `http://localhost:5173` )
- `bun run build` - Build for production
- `bun run preview` - Preview build with Wrangler
- `bun run deploy` - Deploy to Cloudflare Workers

### Project structure
- `app/` - Main application source code
    - `routes/` - Page routes and API endpoints
    - `islands/` - Interactive components
    - `middleware/` - Request middleware
    - `db/` - Database client and schemas
    - `utils/` - Utility functions organized by domain
- `docs/` - Design documentation ( `DESIGN.md` contains detailed specifications)
- `public/` - Static assets

## Code style guidelines
### TypeScript
- Use tabs for indentation
- Use semicolons
- Use camelCase for variable and function names
- Use PascalCase for type/interface names
- Use early returns to reduce nesting
- Prefer immutability (const over let, avoid mutations)
- Write declarative code over imperative code

### Import organization
- Biome automatically sorts imports A-Z, so no need to manually order them
- Write all imports without blank lines between them to ensure proper sorting
- Use `@/` path alias for internal modules

### API routes structure
- Use `createHonoApp()` factory function to create route handlers
- Export route as named export: `export const route = ...`
- Also include default export: `export default route`
- Apply middleware in order: validator, error handler, main handler

### Validation
- Use `@hono/standard-validator` with Zod schemas
- Define validators before route handlers using `sValidator`
- Return appropriate HTTP status codes in validation error handlers (e.g., 400 for bad requests)

### Error handling
- Define status message constants in `@/consts` (e.g., `BAD_REQUEST` , `CONFLICT`, `OK` )
- Use `c.text(MESSAGE, statusCode)` for responses
- Apply `injectExternalErrors` middleware to handle external service errors
- Common status codes:
    - 200: OK
    - 400: Bad Request
    - 401: Unauthorized
    - 409: Conflict
    - 429: Too Many Requests

### Database operations
- Get database client using `getDBClient(c.env.DB)`
- Use Drizzle ORM query builder
- Use `.get()` for single record queries, `.all()` for multiple records
- Name table imports with `Table` suffix (e.g., `usersTable` , `signupSessionsTable` )

### Security
- Hash tokens before storing in database using `hashToken()`
- Generate secure random tokens using `generateSecureToken()`
- Use UUIDv7 for ID generation: `generateUuidv7()`
- Never expose raw tokens in database queries

### Date handling
- Use `Date` objects for timestamps
- Use `offsetMilliSeconds()` utility for calculating expiration times
- Store expiration times in UTC

### Email
- Get Resend client using `getResendClient(c.env.RESEND_API_KEY)`
- Use environment variables for email configuration ( `RESEND_EMAIL_FROM` )
- Include clear expiration information in email content

### Markdown
- Use 4 spaces for indentation

## Testing instructions
1. add the function
2. Write test code for the function
3. Run the test command to confirm all tests pass
- Place `{filename}.spec.ts` in the same directory as `{filename}.ts`
- `"noUncheckedIndexedAccess": true` is configured in TypeScript, so indexed elements may be `undefined` . In test code that doesn't handle `undefined` , throw an error explicitly

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
