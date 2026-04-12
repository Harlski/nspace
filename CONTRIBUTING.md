# Contributing to nspace

Thank you for your interest in contributing to nspace! This document provides guidelines and information to help you contribute effectively.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR-USERNAME/nspace.git
   cd nspace
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL-OWNER/nspace.git
   ```
4. **Set up your development environment** (see [README.md](README.md))

## 🔄 Development Workflow

### 1. Create a Branch

Always create a new branch for your work:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Adding or updating tests

### 2. Make Your Changes

- Write clean, readable TypeScript code
- Follow existing code style and conventions
- Add comments for complex logic
- Test your changes thoroughly in multiplayer scenarios

### 3. Commit Your Changes

Write clear, descriptive commit messages:

```bash
git add .
git commit -m "Add canvas leaderboard real-time updates"
```

Good commit message format:
```
<type>: <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat: add lock functionality for admin objects`
- `fix: prevent portal tile from being claimed in canvas room`
- `docs: update setup instructions in README`

### 4. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title describing the change
- Detailed description of what was changed and why
- Screenshots/GIFs for UI changes
- Any breaking changes or migration notes

## 🧪 Testing

### Manual Testing

Test your changes by:
1. Running the dev server (`npm run dev`)
2. Testing with multiple browser windows/tabs (multiplayer)
3. Testing both dev login and wallet login (if applicable)
4. Checking both desktop and mobile if UI changes are involved

### Key Areas to Test

- **Multiplayer sync**: Changes appear correctly for all connected players
- **Server persistence**: State survives server restart
- **Canvas room**: Identicons load correctly
- **Admin features**: Lock functionality works as expected
- **Performance**: No significant FPS drops or lag

## 📝 Code Guidelines

### TypeScript

- Use TypeScript types, avoid `any`
- Export types/interfaces for shared data structures
- Keep client/server message contracts in sync (`client/src/net/ws.ts` and server)

### Client Code

- Use Three.js best practices (dispose geometries/materials)
- Keep game logic in `client/src/game/`
- Keep UI logic in `client/src/ui/`
- Avoid blocking the main thread

### Server Code

- Keep room state mutations in `server/src/rooms.ts`
- Log important events to the event log
- Rate limit user actions appropriately
- Validate all client input

### Styling

- Follow existing CSS conventions
- Use BEM-style class naming (e.g., `build-block-bar__preview-canvas`)
- Keep styles scoped and maintainable

## 🏗️ Architecture

### Key Files

**Client:**
- `client/src/game/Game.ts` - Main game engine, Three.js rendering
- `client/src/ui/hud.ts` - HUD, menus, overlays
- `client/src/main.ts` - App initialization, WebSocket handling
- `client/src/net/ws.ts` - WebSocket client, message types

**Server:**
- `server/src/rooms.ts` - Room state, multiplayer logic, tick loop
- `server/src/index.ts` - HTTP/WebSocket server setup
- `server/src/auth.ts` - JWT authentication
- `server/src/config.ts` - Admin configuration

### Adding New Features

See [docs/process.md](docs/process.md) for detailed guidance on:
- Adding synced multiplayer features
- Extending the server tick loop
- Adding new message types
- Persisting new data types

## 🐛 Reporting Bugs

When reporting bugs, please include:

1. **Description**: Clear description of the bug
2. **Steps to reproduce**: Exact steps to trigger the bug
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Environment**:
   - Browser and version
   - Operating system
   - Dev or production build
6. **Screenshots/logs**: If applicable

## 💡 Suggesting Features

Feature suggestions are welcome! Please:

1. Check existing issues/PRs first
2. Describe the feature and use case
3. Explain why it would be valuable
4. Consider implementation complexity
5. Be open to discussion and iteration

## 📋 Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Code follows project style guidelines
- [ ] Changes tested in multiplayer environment
- [ ] No console errors or warnings
- [ ] Comments added for complex logic
- [ ] README/docs updated if needed
- [ ] Commit messages are clear and descriptive
- [ ] No sensitive data (API keys, secrets) included
- [ ] `.env` files not committed (only `.env.example`)

## 🎯 Good First Issues

Looking for a place to start? Check issues labeled:
- `good first issue` - Beginner-friendly tasks
- `help wanted` - Community contributions welcome
- `documentation` - Docs improvements needed

## 🤔 Questions?

- **General questions**: Open a GitHub Discussion
- **Bug reports**: Open an Issue
- **Feature requests**: Open an Issue with [Feature Request] prefix
- **Security issues**: Email directly (don't open public issue)

## 📜 Code of Conduct

Be respectful and constructive in all interactions:
- Be welcoming to newcomers
- Respect differing viewpoints
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards others

## 🙏 Thank You!

Your contributions help make nspace better for everyone. Whether you're fixing bugs, adding features, improving docs, or helping others, we appreciate your time and effort!

---

Happy coding! 🎮✨
