import path from 'path';
import test from 'ava';
import proxyquire from 'proxyquire';
import parentConfig from './fixtures/nested/package';
import childConfig from './fixtures/nested/child/package';
import prettierConfig from './fixtures/prettier/package';
import enginesConfig from './fixtures/engines/package';

process.chdir(__dirname);

const manager = proxyquire('../lib/options-manager', {
	'resolve-from': (cwd, path) => `cwd/${path}`
});

test('normalizeOpts: makes all the opts plural and arrays', t => {
	const opts = manager.normalizeOpts({
		env: 'node',
		global: 'foo',
		ignore: 'test.js',
		plugin: 'my-plugin',
		rule: {'my-rule': 'foo'},
		setting: {'my-rule': 'bar'},
		extend: 'foo',
		extension: 'html'
	});

	t.deepEqual(opts, {
		envs: ['node'],
		globals: ['foo'],
		ignores: ['test.js'],
		plugins: ['my-plugin'],
		rules: {'my-rule': 'foo'},
		settings: {'my-rule': 'bar'},
		extends: ['foo'],
		extensions: ['html']
	});
});

test('normalizeOpts: falsie values stay falsie', t => {
	t.deepEqual(manager.normalizeOpts({}), {});
});

test('buildConfig: defaults', t => {
	const config = manager.buildConfig({});
	t.true(/[\\/]\.xo-cache[\\/]?$/.test(config.cacheLocation));
	t.is(config.useEslintrc, false);
	t.is(config.cache, true);
	t.is(config.baseConfig.extends[0], 'xo/esnext');
});

test('buildConfig: esnext', t => {
	const config = manager.buildConfig({esnext: false});
	t.is(config.baseConfig.extends[0], 'xo');
});

test('buildConfig: space: true', t => {
	const config = manager.buildConfig({space: true});
	t.deepEqual(config.rules.indent, ['error', 2, {SwitchCase: 1}]);
});

test('buildConfig: space: 4', t => {
	const config = manager.buildConfig({space: 4});
	t.deepEqual(config.rules.indent, ['error', 4, {SwitchCase: 1}]);
});

test('buildConfig: semicolon', t => {
	const config = manager.buildConfig({semicolon: false});
	t.deepEqual(config.rules, {
		semi: ['error', 'never'],
		'semi-spacing': ['error', {
			before: false,
			after: true
		}]
	});
});

test('buildConfig: prettier: true', t => {
	const config = manager.buildConfig({prettier: true, extends: ['xo-react']});

	t.deepEqual(config.plugins, ['prettier']);
	// Sets the `semi`, `useTabs` and `tabWidth` options in `prettier/prettier` based on the XO `space` and `semicolon` options
	// Sets `singleQuote`, `trailingComma`, `bracketSpacing` and `jsxBracketSameLine` with XO defaults
	t.deepEqual(config.rules, {
		'prettier/prettier': ['error', {
			useTabs: true,
			bracketSpacing: false,
			jsxBracketSameLine: false,
			semi: true,
			singleQuote: true,
			tabWidth: 2,
			trailingComma: 'es5'
		}]});
	// eslint-prettier-config must always be last
	t.deepEqual(config.baseConfig.extends.slice(-1), ['prettier']);
});

test('buildConfig: prettier: true, semicolon: false', t => {
	const config = manager.buildConfig({prettier: true, semicolon: false});

	// Sets the `semi` options in `prettier/prettier` based on the XO `semicolon` option
	t.deepEqual(config.rules['prettier/prettier'], ['error', {
		useTabs: true,
		bracketSpacing: false,
		jsxBracketSameLine: false,
		semi: false,
		singleQuote: true,
		tabWidth: 2,
		trailingComma: 'es5'
	}]);
});

test('buildConfig: prettier: true, space: 4', t => {
	const config = manager.buildConfig({prettier: true, space: 4});

	// Sets `useTabs` and `tabWidth` options in `prettier/prettier` rule based on the XO `space` options
	t.deepEqual(config.rules['prettier/prettier'], ['error', {
		useTabs: false,
		bracketSpacing: false,
		jsxBracketSameLine: false,
		semi: true,
		singleQuote: true,
		tabWidth: 4,
		trailingComma: 'es5'
	}]);
});

test('buildConfig: prettier: true, esnext: false', t => {
	const config = manager.buildConfig({prettier: true, esnext: false});

	// Sets `useTabs` and `tabWidth` options in `prettier/prettier` rule based on the XO `space` options
	t.deepEqual(config.rules['prettier/prettier'], ['error', {
		useTabs: true,
		bracketSpacing: false,
		jsxBracketSameLine: false,
		semi: true,
		singleQuote: true,
		tabWidth: 2,
		trailingComma: 'none'
	}]);
});

test('buildConfig: engines: undefined', t => {
	const config = manager.buildConfig({});

	// Do not include any Node.js version specific rules
	t.is(config.rules['prefer-spread'], undefined);
	t.is(config.rules['prefer-rest-params'], undefined);
	t.is(config.rules['prefer-destructuring'], undefined);
	t.is(config.rules['promise/prefer-await-to-then'], undefined);
});

test('buildConfig: engines: false', t => {
	const config = manager.buildConfig({engines: false});

	// Do not include any Node.js version specific rules
	t.is(config.rules['prefer-spread'], undefined);
	t.is(config.rules['prefer-rest-params'], undefined);
	t.is(config.rules['prefer-destructuring'], undefined);
	t.is(config.rules['promise/prefer-await-to-then'], undefined);
});

test('buildConfig: engines: invalid range', t => {
	const config = manager.buildConfig({engines: {node: '4'}});

	// Do not include any Node.js version specific rules
	t.is(config.rules['prefer-spread'], undefined);
	t.is(config.rules['prefer-rest-params'], undefined);
	t.is(config.rules['prefer-destructuring'], undefined);
	t.is(config.rules['promise/prefer-await-to-then'], undefined);
});

test('buildConfig: engines: >=4', t => {
	const config = manager.buildConfig({engines: {node: '>=4'}});

	// Do not include rules for Node.js 5 and above
	t.is(config.rules['unicorn/prefer-spread'], undefined);
	// Do not include rules for Node.js 6 and above
	t.is(config.rules['prefer-rest-params'], undefined);
	t.is(config.rules['prefer-destructuring'], undefined);
	// Do not include rules for Node.js 8 and above
	t.is(config.rules['promise/prefer-await-to-then'], undefined);
});

test('buildConfig: engines: >=4.1', t => {
	const config = manager.buildConfig({engines: {node: '>=5.1'}});

	// Do not include rules for Node.js 5 and above
	t.is(config.rules['unicorn/prefer-spread'], 'error');
	// Do not include rules for Node.js 6 and above
	t.is(config.rules['prefer-rest-params'], undefined);
	t.is(config.rules['prefer-destructuring'], undefined);
	// Do not include rules for Node.js 8 and above
	t.is(config.rules['promise/prefer-await-to-then'], undefined);
});

test('buildConfig: engines: >=6', t => {
	const config = manager.buildConfig({engines: {node: '>=6'}});

	// Include rules for Node.js 5 and above
	t.is(config.rules['unicorn/prefer-spread'], 'error');
	// Include rules for Node.js 6 and above
	t.is(config.rules['prefer-rest-params'], 'error');
	t.deepEqual(config.rules['prefer-destructuring'], ['error', {array: true, object: true}]);
	// Do not include rules for Node.js 8 and above
	t.is(config.rules['promise/prefer-await-to-then'], undefined);
});

test('buildConfig: engines: >=8', t => {
	const config = manager.buildConfig({engines: {node: '>=8'}});

	// Include rules for Node.js 5 and above
	t.is(config.rules['unicorn/prefer-spread'], 'error');
	// Include rules for Node.js 6 and above
	t.is(config.rules['prefer-rest-params'], 'error');
	t.deepEqual(config.rules['prefer-destructuring'], ['error', {array: true, object: true}]);
	// Include rules for Node.js 8 and above
	t.is(config.rules['promise/prefer-await-to-then'], 'error');
});

test('mergeWithPrettierConf: use `singleQuote`, `trailingComma`, `bracketSpacing` and `jsxBracketSameLine` from `prettier` config if defined', t => {
	const cwd = path.resolve('fixtures', 'prettier');
	const result = manager.mergeWithPrettierConf({cwd});
	const expected = Object.assign({}, prettierConfig.prettier, {tabWidth: 2, useTabs: true, semi: true});
	t.deepEqual(result, expected);
});

test('mergeWithPrettierConf: determine `tabWidth`, `useTabs`, `semi` from xo config', t => {
	const cwd = path.resolve('fixtures', 'prettier');
	const result = manager.mergeWithPrettierConf({cwd, space: 4, semicolon: false});
	const expected = Object.assign({}, prettierConfig.prettier, {tabWidth: 4, useTabs: false, semi: false});
	t.deepEqual(result, expected);
});

test('buildConfig: rules', t => {
	const rules = {'object-curly-spacing': ['error', 'always']};
	const config = manager.buildConfig({rules});
	t.deepEqual(config.rules, rules);
});

test('buildConfig: parser', t => {
	const parser = 'babel-eslint';
	const config = manager.buildConfig({parser});
	t.deepEqual(config.baseConfig.parser, parser);
});

test('buildConfig: settings', t => {
	const settings = {'import/resolver': 'webpack'};
	const config = manager.buildConfig({settings});
	t.deepEqual(config.baseConfig.settings, settings);
});

test('buildConfig: extends', t => {
	const config = manager.buildConfig({extends: [
		'plugin:foo/bar',
		'eslint-config-foo-bar',
		'foo-bar-two'
	]});

	t.deepEqual(config.baseConfig.extends.slice(-3), [
		'plugin:foo/bar',
		'cwd/eslint-config-foo-bar',
		'cwd/eslint-config-foo-bar-two'
	]);
});

test('findApplicableOverrides', t => {
	const result = manager.findApplicableOverrides('/user/dir/foo.js', [
		{files: '**/f*.js'},
		{files: '**/bar.js'},
		{files: '**/*oo.js'},
		{files: '**/*.txt'}
	]);

	t.is(result.hash, 0b1010);
	t.deepEqual(result.applicable, [
		{files: '**/f*.js'},
		{files: '**/*oo.js'}
	]);
});

test('groupConfigs', t => {
	const paths = [
		'/user/foo/hello.js',
		'/user/foo/goodbye.js',
		'/user/foo/howdy.js',
		'/user/bar/hello.js'
	];

	const opts = {
		esnext: false
	};

	const overrides = [
		{
			files: '**/foo/*',
			esnext: true
		},
		{
			files: '**/foo/howdy.js',
			space: 3,
			env: 'mocha'
		}
	];

	const result = manager.groupConfigs(paths, opts, overrides);

	t.deepEqual(result, [
		{
			opts: {
				esnext: true
			},
			paths: ['/user/foo/hello.js', '/user/foo/goodbye.js']
		},
		{
			opts: {
				esnext: true,
				space: 3,
				envs: ['mocha']
			},
			paths: ['/user/foo/howdy.js']
		},
		{
			opts: {
				esnext: false
			},
			paths: ['/user/bar/hello.js']
		}
	].map(obj => {
		obj.opts = Object.assign(manager.emptyOptions(), obj.opts);
		return obj;
	}));
});

test('mergeWithPkgConf: use child if closest', t => {
	const cwd = path.resolve('fixtures', 'nested', 'child');
	const result = manager.mergeWithPkgConf({cwd});
	const expected = Object.assign({}, childConfig.xo, {cwd}, {engines: {}});
	t.deepEqual(result, expected);
});

test('mergeWithPkgConf: use parent if closest', t => {
	const cwd = path.resolve('fixtures', 'nested');
	const result = manager.mergeWithPkgConf({cwd});
	const expected = Object.assign({}, parentConfig.xo, {cwd}, {engines: {}});
	t.deepEqual(result, expected);
});

test('mergeWithPkgConf: use parent if child is ignored', t => {
	const cwd = path.resolve('fixtures', 'nested', 'child-ignore');
	const result = manager.mergeWithPkgConf({cwd});
	const expected = Object.assign({}, parentConfig.xo, {cwd}, {engines: {}});
	t.deepEqual(result, expected);
});

test('mergeWithPkgConf: use child if child is empty', t => {
	const cwd = path.resolve('fixtures', 'nested', 'child-empty');
	const result = manager.mergeWithPkgConf({cwd});
	t.deepEqual(result, {cwd, engines: {}});
});

test('mergeWithPkgConf: read engines from package.json', t => {
	const cwd = path.resolve('fixtures', 'engines');
	const result = manager.mergeWithPkgConf({cwd});
	const expected = Object.assign({}, {engines: enginesConfig.engines}, {cwd});
	t.deepEqual(result, expected);
});

test('mergeWithPkgConf: XO engine options supersede package.json\'s', t => {
	const cwd = path.resolve('fixtures', 'engines');
	const result = manager.mergeWithPkgConf({cwd, engines: {node: '>=8'}});
	const expected = Object.assign({}, {engines: {node: '>=8'}}, {cwd});
	t.deepEqual(result, expected);
});

test('mergeWithPkgConf: XO engine options false supersede package.json\'s', t => {
	const cwd = path.resolve('fixtures', 'engines');
	const result = manager.mergeWithPkgConf({cwd, engines: false});
	const expected = Object.assign({}, {engines: false}, {cwd});
	t.deepEqual(result, expected);
});
