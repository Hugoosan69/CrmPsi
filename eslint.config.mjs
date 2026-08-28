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
    "next-env.d.ts",
    // Separate design/handoff project with its own package.json and tsconfig —
    // kept in-tree as reference material, not compiled or linted by the CSIB app.
    "crm-psi/**",
    // Git worktrees criados por agentes em background. Cada um tem seu próprio .next,
    // e o ".next/**" acima só casa na raiz — sem esta linha o build de um worktree
    // adiciona ~18 mil avisos ao lint deste projeto e o torna inútil.
    ".claude/**",
  ]),
]);

export default eslintConfig;
