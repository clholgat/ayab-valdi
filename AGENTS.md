# AGENTS.md - Guide for AI Coding Assistants

This document provides context and guidelines for AI coding assistants working on this Valdi application.

## Overview

This is a Valdi application that runs natively on iOS, Android, and macOS. Valdi is a cross-platform UI framework that compiles declarative TypeScript components to native views - no web views, no JavaScript bridges.

## Project Structure

- **`modules/`** - Your application modules
  - Each module contains TypeScript/TSX source files
  - `BUILD.bazel` files define how modules are built
  - **There should NOT be individual `tsconfig.json` files in module subdirectories**
  - **There IS a single consolidated `modules/tsconfig.json` file** at the modules/ level
  - `src/` contains your component and business logic code
  - `web/` subdirectories may have their own `tsconfig.json` for web-specific TypeScript compilation
- **`WORKSPACE`** - Bazel workspace configuration
- **`config.yaml`** - Valdi project configuration
- **`.bazelrc`** - Bazel build settings (should match bootstrap template)

## Key Technologies

- **Valdi** - Cross-platform UI framework that compiles to native code
- **TypeScript/TSX** - React-like syntax for declarative UI (but compiles to native, not React)
- **Bazel** - Build system (note: `bzl` is an alias for `bazel`)
- **Flexbox** - Layout system with automatic RTL support

## Development Workflow

### Initial Setup

```bash
# Install Valdi CLI (if not already installed)
cd path/to/valdi/npm_modules/cli
npm run cli:install

# Setup development environment
valdi dev_setup

# Sync project (run after changing dependencies or config)
valdi projectsync
```

### Building and Running

```bash
# Install and run on iOS
valdi install ios

# Install and run on Android  
valdi install android

# Install and run on macOS
valdi install macos

# Start hot reload (for instant updates while developing)
valdi hotreload
```

### Common Commands

```bash
# Sync project configuration and generate IDE files
# This automatically updates modules/tsconfig.json with correct paths
valdi projectsync

# Build specific targets with Bazel
bazel build //modules/{{MODULE_NAME}}:{{MODULE_NAME}}

# Run tests
bazel test //modules/{{MODULE_NAME}}:tests
```

## TypeScript Configuration

### Consolidated tsconfig.json

- **Location**: `modules/tsconfig.json` (at the modules/ directory level, not in individual modules)
- **Purpose**: Single consolidated TypeScript configuration for all modules
- **Auto-updated**: The `valdi projectsync` command automatically detects and updates this file
- **Contains**: 
  - Path mappings for all custom modules
  - Path mappings for Valdi core modules
  - Path mappings for Valdi_Widgets components
  - Projectsync-generated paths for modules that have them
  - Compiler options (jsx: "preserve", lib: ["dom", "ES2019"])

### Individual Module tsconfig.json Files

- **Should NOT exist** in individual module directories (e.g., `modules/ayab_valdi/tsconfig.json`)
- **Exception**: `web/` subdirectories may have their own `tsconfig.json` for web-specific TypeScript compilation (used by `ts_project` rules in BUILD.bazel)

### Projectsync Behavior

The `valdi projectsync` command automatically:
1. Detects if `modules/tsconfig.json` exists
2. If found, consolidates all module paths into that single file
3. Includes projectsync-generated paths for valdi_widgets and custom modules
4. Sets correct compiler options (jsx, lib, etc.)
5. Falls back to individual module tsconfig.json files if consolidated one doesn't exist

**Important**: Always run `valdi projectsync` after:
- Adding new modules
- Changing module dependencies
- Updating BUILD.bazel files
- Any changes that affect TypeScript import paths

## Configuration Files

### .bazelrc

- **Location**: Project root (e.g., `src/.bazelrc`)
- **Should match**: The bootstrap template from `valdi bootstrap`
- **Restoration**: If modified, restore from `Valdi/npm_modules/cli/.metadata/.bazelrc.template`
- **Key settings**:
  - Platform-specific build flags
  - C++ compiler options
  - Java/Kotlin configuration
  - Valdi-specific flags

### WORKSPACE

- **Location**: Project root
- **Purpose**: Defines Bazel workspace and external dependencies
- **Contains**: 
  - Local repository references to Valdi and Valdi_Widgets
  - Workspace initialization calls
  - External dependency declarations

### BUILD.bazel Files

- **Location**: Each module directory and project root
- **Purpose**: Define build rules for modules
- **Key rules**:
  - `valdi_module` - Main module definition
  - `valdi_android_library` - Android-specific implementations
  - `objc_library` - iOS/macOS native implementations
  - `cc_library` - C++ native implementations
  - `ts_project` - Web TypeScript compilation (may reference `web/tsconfig.json`)

## Valdi Component Basics

Components use a class-based pattern with lifecycle methods:

```typescript
import { Component } from 'valdi_core/src/Component';

class MyComponent extends Component {
  // Required: Render the component's UI
  onRender() {
    <view backgroundColor="#FFFC00" padding={30}>
      <label value="Hello World" color="black" />
    </view>;
  }
  
  // Optional lifecycle methods:
  // onMount() - Called when component is first mounted
  // onUnmount() - Called before component is removed
  // onUpdate(prevProps) - Called when component updates
}
```

### Key Concepts

- **TSX/JSX Syntax** - Similar to React but compiles to native views
- **State Management** - Use component properties and setState
- **Flexbox Layout** - Use flexbox properties for layout
- **Event Handlers** - Handle user interactions with callbacks
- **Provider Pattern** - Dependency injection for passing services down the component tree

## Common Patterns

### Styling Components

```typescript
<view 
  backgroundColor="#FFFFFF"
  padding={20}
  flexDirection="column"
  alignItems="center"
>
  <label value="Styled text" fontSize={16} color="#000000" />
</view>
```

### Handling Events

```typescript
class MyButton extends Component {
  private handlePress() {
    console.log('Button pressed!');
  }
  
  onRender() {
    <view onPress={() => this.handlePress()}>
      <label value="Click Me" />
    </view>;
  }
}
```

### Using Providers

```typescript
import { Provider } from 'valdi_core/src/Provider';

class App extends Component {
  onRender() {
    const myService = new MyService();
    
    <Provider value={myService}>
      <MyChildComponent />
    </Provider>;
  }
}
```

## Available Standard Library Modules

- `valdi_core` - Core component and runtime APIs
- `valdi_tsx` - TSX template elements and components
- `valdi_http` - Promise-based HTTP client for network requests
- `valdi_navigation` - Navigation utilities
- `valdi_rxjs` - RxJS integration for reactive programming
- `persistence` - Key-value storage with encryption and TTL support
- `foundation`, `coreutils` - Common utilities (arrays, Base64, LRU cache, UUID, etc.)
- `worker` - Worker service support for background JavaScript execution
- `web_renderer` - Web runtime implementation

## Valdi_Widgets Components

- `widgets` - UI component library (buttons, inputs, etc.)
- `navigation` - Navigation components and controllers
- `valdi_standalone_ui` - Standalone UI components

These are imported via path mappings in `modules/tsconfig.json`:
```typescript
import { CoreButton } from 'widgets/src/components/button/CoreButton';
import { NavigationController } from 'navigation/src/NavigationController';
```

## Debugging

- **VSCode Integration** - Set breakpoints and debug TypeScript code
- **Hermes Debugger** - Use Chrome DevTools for JavaScript debugging
- **Hot Reload** - See changes instantly without rebuilding
- **Native Debugging** - Use Xcode or Android Studio for platform-specific issues

See Valdi documentation at `/docs/docs/workflow-hermes-debugger.md` for detailed debugging instructions.

## Common Pitfalls

1. **Always run `valdi projectsync`** after changing dependencies or config files
2. **Use hot reload during development** - Much faster than rebuilding
3. **Flexbox layout** - Valdi uses flexbox, not native iOS/Android layout
4. **Component state** - Remember to call `setState()` to trigger re-renders
5. **Build cache** - If builds seem stuck, try `bazel clean`
6. **tsconfig.json location** - Use consolidated `modules/tsconfig.json`, not individual module files
7. **Import paths** - Use module names (e.g., `preview/src/Preview`) not relative paths across modules

## Important Files

- **`config.yaml`** - Project configuration (dependencies, settings)
- **`WORKSPACE`** - Bazel workspace and external dependencies
- **`BUILD.bazel`** - Build rules for each module
- **`.bazelrc`** - Bazel build flags and configuration (should match bootstrap template)
- **`modules/tsconfig.json`** - Consolidated TypeScript configuration (auto-updated by projectsync)

## File Organization Rules

### tsconfig.json Files

- ✅ **DO**: Have a single `modules/tsconfig.json` at the modules/ directory level
- ✅ **DO**: Have `web/tsconfig.json` files in web subdirectories (for ts_project rules)
- ❌ **DON'T**: Create individual `tsconfig.json` files in module directories
- ❌ **DON'T**: Manually edit `modules/tsconfig.json` paths (let projectsync handle it)

### Patches

- Local Valdi / Valdi_Widgets fixes live under `src/patches/` and are applied via `archive_override(patches = ...)` in `src/MODULE.bazel`
- Prefer upstreaming patches; remove a patch once the corresponding PR merges upstream
- The Bazel registry is fetched from upstream Valdi at `VALDI_REF` via `./scripts/ensure-valdi-registry.sh` (cached in `src/.valdi-registry/`)

### .bazelrc

- Should match the bootstrap template exactly
- Location: `Valdi/npm_modules/cli/.metadata/.bazelrc.template`
- If modified incorrectly, restore from template

## Getting Help

- **Documentation** - Valdi docs in the framework repository at `/docs/`
- **Discord** - Join the [Valdi Discord community](https://discord.gg/uJyNEeYX2U)
- **Examples** - Check `/apps/` directory in Valdi repository for examples
- **API Reference** - See `/docs/api/` for comprehensive API documentation
- **Codelabs** - Step-by-step tutorials at `/docs/codelabs/`

## Key Points for AI Assistants

1. **This is a Valdi application** - Not React, React Native, or web-based
2. **TSX compiles to native** - No JavaScript runtime on device, components are compiled
3. **Use `valdi` CLI commands** - Primary tool for building and running
4. **Hot reload is fast** - Encourage using it for rapid iteration
5. **Bazel is the build system** - Direct bazel commands available but CLI preferred
6. **Cross-platform by default** - Code runs on iOS, Android, and macOS
7. **Consolidated tsconfig.json** - Single file at `modules/tsconfig.json`, not per-module
8. **Projectsync is automatic** - It detects and updates the consolidated tsconfig.json
9. **Patches in MODULE.bazel** - Upstream Valdi/Widgets via `archive_override`; carry local fixes in `src/patches/`
10. **Import resolution** - Use module names like `preview/src/Preview`, not relative paths

## Troubleshooting

### Import Resolution Errors

1. Run `valdi projectsync` to update `modules/tsconfig.json`
2. Restart TypeScript server in your IDE (VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server")
3. Verify `modules/tsconfig.json` exists and has correct paths
4. Check that individual module `tsconfig.json` files don't exist (they should be removed)

### Build Errors

1. Run `bazel clean` to clear build cache
2. Verify `.bazelrc` matches bootstrap template
3. Check BUILD.bazel files for correct target names
4. Ensure all dependencies are listed in BUILD.bazel files

### Projectsync Not Working

1. Verify `modules/tsconfig.json` exists
2. Check that you're running projectsync from the correct directory
3. Ensure BUILD.bazel files have `valdi_module` rules with correct names
4. Check for syntax errors in BUILD.bazel files

---

*This document is intended for AI coding assistants to quickly understand this Valdi application. For comprehensive Valdi framework documentation, refer to the main Valdi repository at https://github.com/Snapchat/Valdi*
