import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

import rootConfig from '../../eslint.config.mjs';

export default tseslint.config(
	...rootConfig,
	{ name: 'frontend config' },
	{
		ignores: ['dist'],
	},
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			globals: globals.browser,
			parserOptions: {
				project: ['./tsconfig.app.json', './tsconfig.node.json'],
				tsconfigRootDir: import.meta.dirname,
			},
		},
		plugins: {
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
		},
	},
);
