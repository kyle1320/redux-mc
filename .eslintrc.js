/* eslint-env node */
module.exports = {
  root: true,
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "plugin:prettier/recommended"],
  plugins: ["@typescript-eslint", "prettier"],
  ignorePatterns: ["node_modules", "lib", "dist", "*.tsbuildinfo"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off"
  }
};
