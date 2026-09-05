import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coke-music/**",
    "next-env.d.ts",
  ]),
  {
    files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: [
      "app/arena/arena-client.tsx",
      "app/arena/timer-ui.tsx",
      "app/watch/watch-client.tsx",
    ],
    rules: {
      // These components intentionally synchronize React state with external
      // systems: the D1-backed room poll and wall-clock deadlines. The initial
      // fetch/countdown reset belongs to that synchronization effect; the
      // generic React rule treats it as derived local state and reports a
      // false positive for this polling/timer pattern.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
