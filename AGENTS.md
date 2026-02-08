# AGENTS

<skills_system priority="1">

## Available Skills

<!-- SKILLS_TABLE_START -->
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke: `npx openskills read <skill-name>` (run in your shell)
  - For multiple: `npx openskills read skill-one,skill-two`
- The skill content will load with detailed instructions on how to complete the task
- Base directory provided in output for resolving bundled resources (references/, scripts/, assets/)

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless
</usage>

<available_skills>

<skill>
<name>algorithmic-art</name>
<description>Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use this when users request creating art using code, generative art, algorithmic art, flow fields, or particle systems. Create original algorithmic art rather than copying existing artists' work to avoid copyright violations.</description>
<location>project</location>
</skill>

<skill>
<name>brand-guidelines</name>
<description>Applies Anthropic's official brand colors and typography to any sort of artifact that may benefit from having Anthropic's look-and-feel. Use it when brand colors or style guidelines, visual formatting, or company design standards apply.</description>
<location>project</location>
</skill>

<skill>
<name>canvas-design</name>
<description>Create beautiful visual art in .png and .pdf documents using design philosophy. You should use this skill when the user asks to create a poster, piece of art, design, or other static piece. Create original visual designs, never copying existing artists' work to avoid copyright violations.</description>
<location>project</location>
</skill>

<skill>
<name>doc-coauthoring</name>
<description>Guide users through a structured workflow for co-authoring documentation. Use when user wants to write documentation, proposals, technical specs, decision docs, or similar structured content. This workflow helps users efficiently transfer context, refine content through iteration, and verify the doc works for readers. Trigger when user mentions writing docs, creating proposals, drafting specs, or similar documentation tasks.</description>
<location>project</location>
</skill>

<skill>
<name>docx</name>
<description>"Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction. When Claude needs to work with professional documents (.docx files) for: (1) Creating new documents, (2) Modifying or editing content, (3) Working with tracked changes, (4) Adding comments, or any other document tasks"</description>
<location>project</location>
</skill>

<skill>
<name>frontend-design</name>
<description>Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.</description>
<location>project</location>
</skill>

<skill>
<name>internal-comms</name>
<description>A set of resources to help me write all kinds of internal communications, using the formats that my company likes to use. Claude should use this skill whenever asked to write some sort of internal communications (status reports, leadership updates, 3P updates, company newsletters, FAQs, incident reports, project updates, etc.).</description>
<location>project</location>
</skill>

<skill>
<name>mcp-builder</name>
<description>Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Use when building MCP servers to integrate external APIs or services, whether in Python (FastMCP) or Node/TypeScript (MCP SDK).</description>
<location>project</location>
</skill>

<skill>
<name>pdf</name>
<description>Comprehensive PDF manipulation toolkit for extracting text and tables, creating new PDFs, merging/splitting documents, and handling forms. When Claude needs to fill in a PDF form or programmatically process, generate, or analyze PDF documents at scale.</description>
<location>project</location>
</skill>

<skill>
<name>pptx</name>
<description>"Presentation creation, editing, and analysis. When Claude needs to work with presentations (.pptx files) for: (1) Creating new presentations, (2) Modifying or editing content, (3) Working with layouts, (4) Adding comments or speaker notes, or any other presentation tasks"</description>
<location>project</location>
</skill>

<skill>
<name>skill-creator</name>
<description>Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations.</description>
<location>project</location>
</skill>

<skill>
<name>slack-gif-creator</name>
<description>Knowledge and utilities for creating animated GIFs optimized for Slack. Provides constraints, validation tools, and animation concepts. Use when users request animated GIFs for Slack like "make me a GIF of X doing Y for Slack."</description>
<location>project</location>
</skill>

<skill>
<name>template</name>
<description>Replace with description of the skill and when Claude should use it.</description>
<location>project</location>
</skill>

<skill>
<name>theme-factory</name>
<description>Toolkit for styling artifacts with a theme. These artifacts can be slides, docs, reportings, HTML landing pages, etc. There are 10 pre-set themes with colors/fonts that you can apply to any artifact that has been creating, or can generate a new theme on-the-fly.</description>
<location>project</location>
</skill>

<skill>
<name>web-artifacts-builder</name>
<description>Suite of tools for creating elaborate, multi-component claude.ai HTML artifacts using modern frontend web technologies (React, Tailwind CSS, shadcn/ui). Use for complex artifacts requiring state management, routing, or shadcn/ui components - not for simple single-file HTML/JSX artifacts.</description>
<location>project</location>
</skill>

<skill>
<name>webapp-testing</name>
<description>Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs.</description>
<location>project</location>
</skill>

<skill>
<name>xlsx</name>
<description>"Comprehensive spreadsheet creation, editing, and analysis with support for formulas, formatting, data analysis, and visualization. When Claude needs to work with spreadsheets (.xlsx, .xlsm, .csv, .tsv, etc) for: (1) Creating new spreadsheets with formulas and formatting, (2) Reading or analyzing data, (3) Modify existing spreadsheets while preserving formulas, (4) Data analysis and visualization in spreadsheets, or (5) Recalculating formulas"</description>
<location>project</location>
</skill>

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>

# Development Commands

## Build and Development
- `npm run dev` - Start development server with hot reload
- `npm run build` - Production build (runs TypeScript compilation then Vite build)
- `npm run preview` - Preview production build locally

## Code Quality
- `npm run lint` - Run ESLint on all TypeScript/JavaScript files
- `npm run lint -- --fix` - Auto-fix linting issues where possible

## Testing
Vitest is already configured with existing tests. Testing commands:
- `npm test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm test -- path/to/test.test.ts` - Run single test file
- `npm run test:ui` - Run tests with UI interface (if installed)

Test files are located in `src/__tests__/` with `.test.ts` extension.

# Code Style Guidelines

## Project Architecture
- **Tech Stack**: React 19 + TypeScript + Vite + Three.js + Zustand
- **State Management**: Zustand store pattern with immer-like updates
- **3D Rendering**: Three.js for canvas drawing with WebGL
- **Build System**: Vite with React plugin

## TypeScript Configuration
- **Strict Mode**: Enabled with all strict checks
- **Target**: ES2022 (app), ES2023 (node)
- **Module**: ESNext with bundler resolution
- **Linting**: `noUnusedLocals`, `noUnusedParameters` enforced
- **JSX**: `react-jsx` transform

## Import and Module Organization
```typescript
// React imports first
import { useEffect, useRef, useState } from 'react';

// External libraries
import * as THREE from 'three';
import { create } from 'zustand';

// Internal imports (absolute from src/)
import { useDrawingStore } from '../store';
import type { Point, Stroke } from '../types';
import { generateId, distance } from '../utils';
```

## Component Patterns
- **Functional Components** only (no classes)
- Use **React.FC** type for components with props
- Props interfaces defined inline or in separate types file
- Destructure props and store state at component top
- Use `useRef` for Three.js object references
- Handle cleanup in useEffect returns

## State Management (Zustand)
- Store interfaces defined with clear property grouping
- Actions defined as arrow functions in store interface
- Immer-like immutable updates using spread syntax
- History management for undo/redo functionality
- Separate state domains (strokes, canvas, tools, history)

## Three.js Conventions
- Use **OrthographicCamera** for 2D drawing canvas
- **TubeGeometry** for smooth stroke rendering
- Proper disposal in cleanup: geometries, materials, renderers
- Grid and axes helpers for canvas orientation
- Z-depth separation: grid (-1), strokes (0.1), preview (0.05)

## Error Handling
- **Graceful degradation** for Three.js context loss
- **Null checks** before scene/renderer operations
- **Bounds checking** for zoom levels (0.5 to 5.0)
- **Input validation** for canvas coordinates
- **Cleanup protection** with removeChild checks

## Naming Conventions
- **Components**: PascalCase (DrawingCanvas, Toolbar)
- **Functions**: camelCase (createTubeFromPoints, screenToWorld)
- **Variables**: camelCase (currentStrokePoints, strokeLinesRef)
- **Constants**: UPPER_SNAKE_CASE for exportable constants
- **Types**: PascalCase interfaces (Point, Stroke, CanvasState)
- **Files**: kebab-case for components (drawing-canvas.tsx), camelCase for utilities

## Code Organization
- **Components**: `src/components/` - React components
- **State**: `src/store.ts` - Zustand store
- **Types**: `src/types.ts` - TypeScript interfaces
- **Utilities**: `src/utils.ts` - Helper functions
- **Specialized**: `src/shapePredict.ts` - Domain-specific logic



## Common Patterns
- **Three.js cleanup**: Always dispose geometries/materials in useEffect returns
- **Canvas coordinates**: Use `screenToWorld()` helper for mouse position conversion
- **Stroke rendering**: Use `createTubeFromPoints()` for consistent line rendering
- **Preview strokes**: Use tube geometry with 0.05 z-depth and 0.6 opacity
- **Final strokes**: Use tube geometry with 0.1 z-depth and 1.0 opacity

## Performance Guidelines
- **Three.js**: Update geometries in-place to avoid flicker
- **React**: Use dependency arrays correctly in useEffect
- **Memory**: Dispose Three.js resources on cleanup
- **Rendering**: Single requestAnimationFrame loop per component
- **Event Listeners**: Remove listeners in cleanup functions

## ESLint Configuration
- **Config**: Uses flat config with TypeScript ESLint
- **React Hooks**: Enforced via eslint-plugin-react-hooks
- **React Refresh**: HMR compatibility via eslint-plugin-react-refresh
- **TypeScript**: Strict mode with `noUnusedLocals` and `noUnusedParameters`
- **Globals**: Browser globals configured
- **Ignores**: `dist/` directory ignored

## File Structure Patterns
```
src/
├── components/          # React components (.tsx)
├── store.ts            # Zustand state management
├── types.ts           # TypeScript type definitions
├── utils.ts           # Utility functions
├── shapePredict.ts    # Domain-specific algorithms
└── App.tsx           # Main application component
```

## Common Patterns
- **Three.js cleanup**: Always dispose geometries/materials in useEffect returns
- **Canvas coordinates**: Use `screenToWorld()` helper for mouse position conversion
- **Stroke rendering**: Use `createTubeFromPoints()` for consistent line rendering
- **Preview strokes**: Use tube geometry with 0.05 z-depth and 0.6 opacity
- **Final strokes**: Use tube geometry with 0.1 z-depth and 1.0 opacity

## React Hooks Best Practices
- **useCallback**: Wrap functions used in useEffect dependencies
- **useRef**: Use for Three.js objects and DOM element references
- **useEffect**: Clean up event listeners and Three.js resources
- **Dependency arrays**: Include all external dependencies, no unused warnings

## Three.js Specific Guidelines
- **Aspect-correct camera**: Update frustum on resize/zoom to prevent distortion
- **Z-depth layering**: Grid (-1), preview strokes (0.05), final strokes (0.1)
- **Geometry disposal**: Always dispose geometries when updating/replacing
- **Material disposal**: Dispose materials along with geometries
- **Single canvas**: Avoid double canvas issues in React Strict Mode

## State Management Patterns
- **Immutable updates**: Use spread syntax for state changes
- **History management**: Maintain undo/redo stack with proper indexing
- **Predict feature**: Use `displayPoints` for shape-predicted strokes
- **Canvas state**: Include zoom, pan, and predict settings in save/load
