# Affluvia Coding Style & Conventions

## Code Style
- **Language**: TypeScript throughout (frontend and backend)
- **Component Style**: Functional components with React hooks
- **Naming Conventions**: 
  - PascalCase for components and interfaces
  - camelCase for variables, functions, props
  - kebab-case for file names
  - UPPER_CASE for constants

## UI/UX Patterns
- **Dark Theme**: Primary theme with gray-900/gray-800 gradients
- **Color Scheme**: 
  - Primary: Purple (#8A00C4)
  - Gradients: from-purple-600 to-blue-600
  - Text: white primary, gray-400 secondary
  - Borders: gray-700
  - Backgrounds: from-gray-900 to-gray-800

## Component Structure
- Use Radix UI components as base
- Tailwind CSS for styling with custom gradient classes
- Framer Motion for animations
- Card-based layouts with consistent spacing
- Responsive design with grid layouts

## File Organization
- Components in `/client/src/components/[feature]/`
- Shared types in `/shared/`
- Services in `/client/src/services/`
- Backend in `/server/`

## State Management
- React Context API for global state
- React Query for server state
- Local state with useState/useReducer
- Custom hooks for complex logic

## Type Safety
- Strict TypeScript configuration
- Zod for runtime validation
- Shared type definitions between frontend/backend
- Interface definitions for all props and data structures