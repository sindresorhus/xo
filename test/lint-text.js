import fs from 'fs';
import path from 'path';
import test from 'ava';
import pify from 'pify';
import fn from '..';

process.chdir(__dirname);

const readFile = pify(fs.readFile);
const hasRule = (results, ruleId) => results[0].messages.some(x => x.ruleId === ruleId);

test('.lintText()', t => {
	const {results} = fn.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n');
	t.true(hasRule(results, 'semi'));
});

test('default `ignores`', t => {
	const result = fn.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n', {
		filename: 'node_modules/ignored/index.js'
	});
	t.is(result.errorCount, 0);
	t.is(result.warningCount, 0);
});

test('`ignores` option', t => {
	const result = fn.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n', {
		filename: 'ignored/index.js',
		ignores: ['ignored/**/*.js']
	});
	t.is(result.errorCount, 0);
	t.is(result.warningCount, 0);
});

test('`ignores` option without cwd', t => {
	const result = fn.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n', {
		filename: 'ignored/index.js',
		ignores: ['ignored/**/*.js']
	});
	t.is(result.errorCount, 0);
	t.is(result.warningCount, 0);
});

test('respect overrides', t => {
	const result = fn.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n', {
		filename: 'ignored/index.js',
		ignores: ['ignored/**/*.js'],
		overrides: [
			{
				files: ['ignored/**/*.js'],
				ignores: []
			}
		]
	});
	t.is(result.errorCount, 1);
	t.is(result.warningCount, 0);
});

test('overriden ignore', t => {
	const result = fn.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n', {
		filename: 'unignored.js',
		overrides: [
			{
				files: ['unignored.js'],
				ignores: ['unignored.js']
			}
		]
	});
	t.is(result.errorCount, 0);
	t.is(result.warningCount, 0);
});

test('`ignores` option without filename', t => {
	t.throws(() => {
		fn.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n', {
			ignores: ['ignored/**/*.js']
		});
	}, /The `ignores` option requires the `filename` option to be defined./u);
});

test('JSX support', t => {
	const {results} = fn.lintText('const app = <div className="appClass">Hello, React!</div>;\n');
	t.true(hasRule(results, 'no-unused-vars'));
});

test('plugin support', t => {
	const {results} = fn.lintText('var React;\nReact.render(<App/>);\n', {
		plugins: ['react'],
		rules: {'react/jsx-no-undef': 'error'}
	});
	t.true(hasRule(results, 'react/jsx-no-undef'));
});

test('prevent use of extended native objects', t => {
	const {results} = fn.lintText('[].unicorn();\n');
	t.true(hasRule(results, 'no-use-extend-native/no-use-extend-native'));
});

test('extends support', t => {
	const {results} = fn.lintText('var React;\nReact.render(<App/>);\n', {
		extends: 'xo-react'
	});
	t.true(hasRule(results, 'react/jsx-no-undef'));
});

test('extends support with `esnext` option', t => {
	const {results} = fn.lintText('import path from \'path\';\nlet React;\nReact.render(<App/>);\n', {
		extends: 'xo-react'
	});
	t.true(hasRule(results, 'react/jsx-no-undef'));
});

test('disable style rules when `prettier` option is enabled', t => {
	const withoutPrettier = fn.lintText('(a) => {}\n', {filename: 'test.js'}).results;
	// `arrow-parens` is enabled
	t.true(hasRule(withoutPrettier, 'arrow-parens'));
	// `prettier/prettier` is disabled
	t.false(hasRule(withoutPrettier, 'prettier/prettier'));

	const withPrettier = fn.lintText('(a) => {}\n', {prettier: true, filename: 'test.js'}).results;
	// `arrow-parens` is disabled by `eslint-config-prettier`
	t.false(hasRule(withPrettier, 'arrow-parens'));
	// `prettier/prettier` is enabled
	t.true(hasRule(withPrettier, 'prettier/prettier'));
});

test('extends `react` support with `prettier` option', t => {
	const {results} = fn.lintText('<Hello name={ firstname } />;\n', {extends: 'xo-react', prettier: true, filename: 'test.jsx'});
	// `react/jsx-curly-spacing` is disabled by `eslint-config-prettier`
	t.false(hasRule(results, 'react/jsx-curly-spacing'));
	// `prettier/prettier` is enabled
	t.true(hasRule(results, 'prettier/prettier'));
});

test('always use the latest ECMAScript parser so esnext syntax won\'t throw in normal mode', t => {
	const {results} = fn.lintText('async function foo() {}\n\nfoo();\n');
	t.is(results[0].errorCount, 0);
});

test('regression test for #71', t => {
	const {results} = fn.lintText('const foo = { key: \'value\' };\nconsole.log(foo);\n', {
		extends: path.join(__dirname, 'fixtures/extends.js')
	});
	t.is(results[0].errorCount, 0, results[0]);
});

test('lintText() - overrides support', async t => {
	const cwd = path.join(__dirname, 'fixtures/overrides');
	const bar = path.join(cwd, 'test/bar.js');
	const barResults = fn.lintText(await readFile(bar, 'utf8'), {filename: bar, cwd}).results;
	t.is(barResults[0].errorCount, 0, barResults[0]);

	const foo = path.join(cwd, 'test/foo.js');
	const fooResults = fn.lintText(await readFile(foo, 'utf8'), {filename: foo, cwd}).results;
	t.is(fooResults[0].errorCount, 0, fooResults[0]);

	const index = path.join(cwd, 'test/index.js');
	const indexResults = fn.lintText(await readFile(bar, 'utf8'), {filename: index, cwd}).results;
	t.is(indexResults[0].errorCount, 0, indexResults[0]);
});

test('do not lint gitignored files if filename is given', async t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore');
	const ignoredPath = path.resolve('fixtures/gitignore/test/foo.js');
	const ignored = await readFile(ignoredPath, 'utf8');
	const {results} = fn.lintText(ignored, {filename: ignoredPath, cwd});
	t.is(results[0].errorCount, 0);
});

test('lint gitignored files if filename is not given', async t => {
	const ignoredPath = path.resolve('fixtures/gitignore/test/foo.js');
	const ignored = await readFile(ignoredPath, 'utf8');
	const {results} = fn.lintText(ignored);
	t.true(results[0].errorCount > 0);
});

test('do not lint gitignored files in file with negative gitignores', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const ignoredPath = path.resolve('fixtures/negative-gitignore/bar.js');
	const ignored = await readFile(ignoredPath, 'utf8');
	const {results} = fn.lintText(ignored, {filename: ignoredPath, cwd});
	t.is(results[0].errorCount, 0);
});

test('multiple negative patterns should act as positive patterns', async t => {
	const cwd = path.join(__dirname, 'fixtures', 'gitignore-multiple-negation');
	const filename = path.join(cwd, '!!!unicorn.js');
	const text = await readFile(filename, 'utf8');
	const {results} = fn.lintText(text, {filename, cwd});
	t.is(results[0].errorCount, 0);
});

test('lint negatively gitignored files', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const glob = path.posix.join(cwd, '*');
	const {results} = await fn.lintFiles(glob, {cwd});

	t.true(results[0].errorCount > 0);
});

test('do not lint eslintignored files if filename is given', async t => {
	const cwd = path.join(__dirname, 'fixtures/eslintignore');
	const ignoredPath = path.resolve('fixtures/eslintignore/bar.js');
	const ignored = await readFile(ignoredPath, 'utf8');
	const {results} = fn.lintText(ignored, {filename: ignoredPath, cwd});
	t.is(results[0].errorCount, 0);
});

test('lint eslintignored files if filename is not given', async t => {
	const ignoredPath = path.resolve('fixtures/eslintignore/bar.js');
	const ignored = await readFile(ignoredPath, 'utf8');
	const {results} = fn.lintText(ignored);
	t.true(results[0].errorCount > 0);
});

test('enable rules based on nodeVersion', async t => {
	const cwd = path.join(__dirname, 'fixtures', 'engines-overrides');
	const filename = path.join(cwd, 'promise-then.js');
	const text = await readFile(filename, 'utf8');

	let {results} = fn.lintText(text, {nodeVersion: '>=8.0.0'});
	t.true(hasRule(results, 'promise/prefer-await-to-then'));

	({results} = fn.lintText(text, {nodeVersion: '>=6.0.0'}));
	t.false(hasRule(results, 'promise/prefer-await-to-then'));
});

test('enable rules based on nodeVersion in override', async t => {
	const cwd = path.join(__dirname, 'fixtures', 'engines-overrides');
	const filename = path.join(cwd, 'promise-then.js');
	const text = await readFile(filename, 'utf8');

	let {results} = fn.lintText(text, {
		nodeVersion: '>=8.0.0',
		filename: 'promise-then.js',
		overrides: [
			{
				files: 'promise-*.js',
				nodeVersion: '>=6.0.0'
			}
		]});
	t.false(hasRule(results, 'promise/prefer-await-to-then'));

	({results} = fn.lintText(text, {
		nodeVersion: '>=6.0.0',
		filename: 'promise-then.js',
		overrides: [
			{
				files: 'promise-*.js',
				nodeVersion: '>=8.0.0'
			}
		]}));
	t.true(hasRule(results, 'promise/prefer-await-to-then'));
});

test('find configurations close to linted file', t => {
	let {results} = fn.lintText('console.log(\'semicolon\');\n', {filename: 'fixtures/nested-configs/child/semicolon.js'});
	t.true(hasRule(results, 'semi'));

	({results} = fn.lintText('console.log(\'semicolon\');\n', {filename: 'fixtures/nested-configs/child-override/child-prettier-override/semicolon.js'}));
	t.true(hasRule(results, 'prettier/prettier'));

	({results} = fn.lintText('console.log(\'no-semicolon\')\n', {filename: 'fixtures/nested-configs/no-semicolon.js'}));
	t.true(hasRule(results, 'semi'));

	({results} = fn.lintText(`console.log([
  2
]);\n`, {filename: 'fixtures/nested-configs/child-override/two-spaces.js'}));
	t.true(hasRule(results, 'indent'));
});

test('typescript files', t => {
	let {results} = fn.lintText(`console.log([
  2
]);
`, {filename: 'fixtures/typescript/two-spaces.tsx'});
	t.true(hasRule(results, '@typescript-eslint/indent'));

	({results} = fn.lintText(`console.log([
  2
]);
`, {filename: 'fixtures/typescript/two-spaces.tsx', space: 2}));
	t.is(results[0].errorCount, 0);

	({results} = fn.lintText('console.log(\'extra-semicolon\');;\n', {filename: 'fixtures/typescript/child/extra-semicolon.ts'}));
	t.true(hasRule(results, '@typescript-eslint/no-extra-semi'));

	({results} = fn.lintText('console.log(\'no-semicolon\')\n', {filename: 'fixtures/typescript/child/no-semicolon.ts', semicolon: false}));
	t.is(results[0].errorCount, 0);

	({results} = fn.lintText(`console.log([
    4
]);
`, {filename: 'fixtures/typescript/child/sub-child/four-spaces.ts'}));
	t.true(hasRule(results, '@typescript-eslint/indent'));

	({results} = fn.lintText(`console.log([
    4
]);
`, {filename: 'fixtures/typescript/child/sub-child/four-spaces.ts', space: 4}));
	t.is(results[0].errorCount, 0);
});

function configType(t, {dir}) {
	const {results} = fn.lintText('var obj = { a: 1 };\n', {cwd: path.resolve('fixtures', 'config-files', dir), filename: 'file.js'});
	t.true(hasRule(results, 'no-var'));
}

configType.title = (_, {type}) => `load config from ${type}`.trim();

test(configType, {type: 'xo.config.js', dir: 'xo-config_js'});
test(configType, {type: '.xo-config.js', dir: 'xo-config_js'});
test(configType, {type: '.xo-config.json', dir: 'xo-config_json'});
test(configType, {type: '.xo-config', dir: 'xo-config'});
