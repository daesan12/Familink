import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const requiredPaths = [
  'App.tsx',
  'package.json',
  'tsconfig.json',
  'src/app-shell/AppShell.tsx',
  'src/app-shell/BottomTabBar.tsx',
  'src/app-shell/CurrentGroupSwitcher.tsx',
  'src/app-shell/index.ts',
  'src/app-shell/navigation.ts',
  'src/app-shell/navigation.test.mjs',
  'src/app-shell/types.ts',
  'src/features/feed/index.ts',
  'src/features/feed/types.ts',
  'src/features/feed/api/feedApi.ts',
  'src/features/feed/components/FeedItem.tsx',
  'src/features/feed/hooks/useFeed.ts',
  'src/features/feed/screens/FeedScreen.tsx',
  'src/features/feed/screens/PostDetailScreen.tsx',
];

await Promise.all(
  requiredPaths.map(async relativePath => {
    const fileStats = await stat(path.join(frontendRoot, relativePath));

    if (!fileStats.isFile()) {
      throw new Error(`Required path is not a file: ${relativePath}`);
    }
  }),
);

await Promise.all(
  ['package.json', 'tsconfig.json'].map(async relativePath => {
    const contents = await readFile(
      path.join(frontendRoot, relativePath),
      'utf8',
    );
    JSON.parse(contents);
  }),
);

process.stdout.write('Frontend structure check passed.\n');
