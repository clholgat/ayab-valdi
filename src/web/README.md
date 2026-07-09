# ayab_web web server

This is a minimal web server for running the ayab_web npm package built by valdi_exported_library.

## Quick Start

From the `web` directory, simply run:

```bash
npm start
# or
./start.sh
```

This will automatically:
1. Build the `ayab_web` npm package using Bazel
2. Link the npm package
3. Install dependencies (if needed)
4. Link `ayab_web` in this project
5. Start the web server

Open up `http://localhost:3030/` in a web browser once the server starts.

## Manual Setup (if needed)

If you prefer to do it manually:

### Build the web dependencies

First, build the ayab_web npm package:

```bash
cd ..
bazel build :ayab_web
```

Then link the npm package:

```bash
cd bazel-bin/ayab_web 
npm link
```

### Setup and run

From the `web` directory:

```bash
npm install
npm link ayab_web
```

`link` has to be run after install because it modifies the `node_modules` folder.

### Run the dev server

From the `web` directory:

```bash
npm run serve
```

The app should hotreload when you make changes.

## Troubleshooting

### TypeScript TS5055 Error

If you encounter a `TS5055: Cannot write file because it would overwrite input file` error, this is a known issue with the Valdi build system. Try:

1. Clean the bazel cache:
   ```bash
   cd ..
   bazel clean --expunge
   ```

2. Clean Valdi build artifacts:
   ```bash
   cd ..
   rm -rf .valdi_build
   ```

3. Rebuild:
   ```bash
   bazel build :ayab_web
   ```

If the issue persists, this may be a bug in the Valdi framework version you're using. Check if there's an updated version of Valdi available or report the issue to the Valdi repository.
