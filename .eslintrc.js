module.exports = {
	root: true,
	env: {
		browser: true,
		es2021: true,
		node: true,
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: ['tsconfig.json'],
		sourceType: 'module',
		extraFileExtensions: ['.json'],
	},
	ignorePatterns: ['dist/**', 'node_modules/**'],
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
				// This rule applies to n8n main-repo credentials only (internal short keys).
				// Community credentials must use a full HTTP URL instead.
				'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
			},
		},
		{
			files: ['package.json'],
			plugins: ['n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/community'],
		},
	],
};
