import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
	baseDirectory: __dirname,
});

const eslintConfig = [
	...compat.extends("next/core-web-vitals", "next/typescript"),
	// Temporarily relax strict rules for migration pass — we'll re-enable and fix later
	{
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
			'no-unused-vars': 'off',
			'@typescript-eslint/no-empty-object-type': 'off'
		},
	},
];

export default eslintConfig;
