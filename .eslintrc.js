const path = require("path");

module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["react", "react-hooks"],

  ignorePatterns: [
    ".eslintrc.js",
    "codegen.ts",
    "tsup.config.ts",
    "vite.config.mjs",
  ],

  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
  ],

  parserOptions: {
    sourceType: "module",
    project: path.resolve(__dirname + "/tsconfig.json"),
  },

  env: {
    browser: true,
    es2022: true,
  },

  overrides: [
    {
      files: ["**/__{mocks,tests}__/**/*.{ts,tsx}"],
      rules: {
        "no-empty": ["error", { allowEmptyCatch: true }],
      },
    },
    {
      files: ["*.d.ts"],
      rules: {
        "@typescript-eslint/consistent-type-definitions": "off",
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
    {
      files: ["clients/**/src/graphql/**/*.{ts,tsx}"],
      rules: {
        "@typescript-eslint/ban-types": "off",
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ],

  rules: {
    "no-implicit-coercion": "error",
    "no-param-reassign": "error",
    "no-var": "error",
    "object-shorthand": "warn",
    "prefer-const": "error",

    "no-extra-boolean-cast": "off",

    "react/jsx-boolean-value": ["error", "always"],

    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
  },
};
