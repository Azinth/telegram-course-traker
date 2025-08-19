const nextJest = require("next/jest");

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: "./",
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "node",
  testMatch: [
    "**/__tests__/**/*.(js|jsx|ts|tsx)",
    "**/*.(test|spec).(js|jsx|ts|tsx)",
  ],
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/app/**/layout.tsx",
    "!src/app/**/page.tsx",
    "!src/app/**/loading.tsx",
    "!src/app/**/error.tsx",
    "!src/app/**/not-found.tsx",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testTimeout: 30000, // 30 seconds for database operations
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
