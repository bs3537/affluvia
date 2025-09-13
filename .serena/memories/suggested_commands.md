# Suggested Commands for Affluvia Development

## Development Commands
- `npm run dev` - Start development server (frontend + backend)
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run check` - TypeScript type checking

## Database Commands
- `npm run db:push` - Push database schema changes (Drizzle)
- Database migrations are in `/migrations/` directory

## Testing Commands
- `npm test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage

## File Operations
- Use `search-helper.sh` for enhanced codebase searching
- Use `enhanced-codebase-search.ts` for TypeScript search API
- Use `warp-search.sh` for advanced search patterns

## Git Commands
- Standard git workflow
- Repository is at: /Users/bhavneesh/Desktop/affluvia/affluvia

## System-specific Commands (Darwin/macOS)
- `ls` - List directory contents
- `grep` - Text search (though enhanced search tools preferred)
- `find` - Find files
- `cd` - Change directory

## Development Workflow
1. Make changes to components in appropriate directories
2. Use TypeScript for all new code
3. Follow existing patterns for styling and component structure
4. Test changes with `npm run dev`
5. Run type checking with `npm run check`
6. Commit changes following existing patterns