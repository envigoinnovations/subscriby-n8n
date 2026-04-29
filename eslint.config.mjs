import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
	{ ignores: ['dist/**', 'node_modules/**'] },
	...compat.config({
		env: { browser: true, es2021: true, node: true },
		parser: '@typescript-eslint/parser',
		parserOptions: {
			project: ['tsconfig.json'],
			sourceType: 'module',
			extraFileExtensions: ['.json'],
		},
		overrides: [
			{
				files: ['nodes/**/*.ts'],
				plugins: ['n8n-nodes-base'],
				extends: ['plugin:n8n-nodes-base/nodes'],
			},
			{
				files: ['credentials/**/*.ts'],
				plugins: ['n8n-nodes-base'],
				extends: ['plugin:n8n-nodes-base/credentials'],
				rules: {
					'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
				},
			},
			{
				files: ['package.json'],
				plugins: ['n8n-nodes-base'],
				extends: ['plugin:n8n-nodes-base/community'],
			},
		],
	}),
];
