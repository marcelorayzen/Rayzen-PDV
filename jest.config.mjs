export default {
  projects: [
    {
      displayName: "unit",
      testEnvironment: "node",
      testMatch: ["<rootDir>/**/test/unit/**/*.spec.mjs"],
      moduleFileExtensions: ["js", "mjs", "json"],
      testPathIgnorePatterns: ["/node_modules/", "/dist/"],
      moduleNameMapper: {
        "^node:sqlite$": "<rootDir>/test/shims/node-sqlite.mjs"
      },
      transform: {}
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      testMatch: ["<rootDir>/**/test/integration/**/*.spec.mjs"],
      moduleFileExtensions: ["js", "mjs", "json"],
      testPathIgnorePatterns: ["/node_modules/", "/dist/"],
      moduleNameMapper: {
        "^node:sqlite$": "<rootDir>/test/shims/node-sqlite.mjs"
      },
      transform: {}
    }
  ]
};
