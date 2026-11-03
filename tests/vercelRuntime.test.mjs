import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import ts from 'typescript'

test('API and shared server compile from root config and execute as production JavaScript ESM', () => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const temporaryRoot = join(root, 'node_modules', '.tmp')
  mkdirSync(temporaryRoot, { recursive: true })
  const output = mkdtempSync(join(temporaryRoot, 'vercel-runtime-'))
  try {
    const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile)
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
    assert.deepEqual(parsed.options.types, ['node'], 'The root config must provide Node types to the Vercel compiler')
    const program = ts.createProgram([join(root, 'api/save-strip.ts')], {
      ...parsed.options,
      rootDir: root,
      outDir: output,
      noEmit: false,
      noEmitOnError: true,
    })
    const result = program.emit()
    const diagnostics = [...ts.getPreEmitDiagnostics(program), ...result.diagnostics]
    assert.equal(result.emitSkipped, false, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (value) => value, getCurrentDirectory: () => root, getNewLine: () => '\n',
    }))
    const entry = join(output, 'api/save-strip.js')
    const emitted = readFileSync(entry, 'utf8')
    assert.match(emitted, /from ['"]\.\.\/server\/saveStrip\.js['"]/)
    assert.doesNotMatch(emitted, /from ['"][^'"]+\.ts['"]/)
    writeFileSync(join(output, 'package.json'), JSON.stringify({ type: 'module' }))
    const script = `
      const { default: handler } = await import(${JSON.stringify(pathToFileURL(entry).href)});
      let status;
      let responseBody;
      await handler({ method: 'GET', headers: {} }, {
        set statusCode(value) { status = value },
        setHeader() {},
        end(value) { responseBody = JSON.parse(value) },
      });
      if (status !== 200 || responseBody.enabled !== false) throw new Error('API did not initialize correctly');
      console.log('Runtime GET /api/save-strip: HTTP 200');
    `
    const execution = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: output,
      encoding: 'utf8',
      env: { ...process.env, GOOGLE_DRIVE_UPLOAD_URL: '', GOOGLE_DRIVE_UPLOAD_SECRET: '' },
    })
    assert.equal(execution.status, 0, execution.stderr)
    assert.match(execution.stdout, /HTTP 200/)
  } finally {
    rmSync(output, { recursive: true, force: true })
  }
})
