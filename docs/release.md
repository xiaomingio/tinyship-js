# TinyShip Release Workflow

This file is the release workflow source of truth. Keep the package release commit separate from the demo consumer update. The version tag must point to the commit that produced the npm package, not to the later commit that updates `tinyship-demo` to consume that package.

## Package Release Commit

Update `tinyship` source, tests, and docs first. Before publishing to npm, bump the package version in `tinyship/package.json` and `tinyship/package-lock.json`:

```bash
cd tinyship
npm version <version> --no-git-tag-version
```

Then verify the package at that version:

```bash
npm test
npm run typecheck
npm pack --dry-run
```

Commit only the package release changes:

```bash
cd ..
git add README.md README.zh-CN.md docs/release.md tinyship
git commit -m "release: tinyship <version>"
```

Publish from that commit:

```bash
cd tinyship
npm publish
```

Tag the same package release commit:

```bash
cd ..
git tag -a v<version> -m "@xiaomingio/tinyship v<version>"
```

## Demo Consumer Commit

After the npm package is available, update and verify the demo in a separate commit:

```bash
cd tinyship-demo
npm install -D @xiaomingio/tinyship@^<version>
npm run deploy:validate
npx tinyship dry-run service tinyship-demo-user
npx tinyship dry-run host frontend

cd ..
git add tinyship-demo
git commit -m "chore: update demo to tinyship <version>"
```

Push the branch and tag after both commits are ready:

```bash
git push origin main
git push origin v<version>
```
