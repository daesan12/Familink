import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const requiredPaths = [
  "App.tsx",
  "package.json",
  "README.md",
  "tsconfig.json",
  "scripts/start-android-dev.mjs",
  "scripts/start-android-dev.test.mjs",
  "src/app-shell/AppShell.tsx",
  "src/app-shell/BottomTabBar.tsx",
  "src/app-shell/CurrentGroupSwitcher.tsx",
  "src/app-shell/index.ts",
  "src/app-shell/navigation.ts",
  "src/app-shell/navigation.test.mjs",
  "src/app-shell/types.ts",
  "src/features/auth/screens/WelcomeScreen.tsx",
  "src/features/auth/screens/SignupFlowScreen.tsx",
  "src/features/auth/screens/SignedInWelcomeScreen.tsx",
  "src/features/auth/screens/GroupOnboardingScreen.tsx",
  "src/features/auth/components/LoginBottomSheet.tsx",
  "src/features/auth/components/LogoutConfirmationModal.tsx",
  "src/features/auth/components/FloatingIllustration.tsx",
  "src/features/auth/hooks/useScreenEntrance.ts",
  "src/features/auth/api/mockAuthGateway.ts",
  "src/features/auth/validation.ts",
  "src/assets/images/family-album-welcome-illustration.png",
  "src/features/feed/index.ts",
  "src/features/feed/types.ts",
  "src/features/feed/api/feedApi.ts",
  "src/features/feed/components/FeedItem.tsx",
  "src/features/feed/hooks/useFeed.ts",
  "src/features/feed/screens/FeedScreen.tsx",
  "src/features/feed/screens/PostDetailScreen.tsx",
  ".env.development.example",
  ".env.production.example",
  "src/shared/api/apiClient.ts",
  "src/shared/api/apiConfig.ts",
  "src/shared/api/apiError.ts",
  "src/shared/api/apiTypes.ts",
  "src/shared/api/index.ts",
  "src/features/reports/index.ts",
  "src/features/reports/types.ts",
  "src/features/reports/reportPresentation.ts",
  "src/features/reports/fixtures/reportFixtures.ts",
  "src/features/reports/screens/ReportScreen.tsx",
  "src/features/reports/components/DailyReportCard.tsx",
  "src/features/reports/components/CallReportRow.tsx",
  "src/features/reports/components/CallReportDetailModal.tsx",
  "src/features/reports/components/ReportPageIndicator.tsx",
];

await Promise.all(
  requiredPaths.map(async (relativePath) => {
    const fileStats = await stat(path.join(frontendRoot, relativePath));

    if (!fileStats.isFile()) {
      throw new Error(`Required path is not a file: ${relativePath}`);
    }
  })
);

await Promise.all(
  ["package.json", "tsconfig.json"].map(async (relativePath) => {
    const contents = await readFile(
      path.join(frontendRoot, relativePath),
      "utf8"
    );
    JSON.parse(contents);
  })
);

process.stdout.write("Frontend structure check passed.\n");
