#!/usr/bin/env node
import { execFile } from 'node:child_process'

function check(bin, args = ['--version']) {
  return new Promise((resolve) => {
    const p = execFile(bin, args, (err, stdout, stderr) => {
      if (err) return resolve({ ok: false, msg: err.message })
      const out = (stdout || stderr || '').toString().trim().split('\n')[0]
      resolve({ ok: true, msg: out })
    })
    p.on('error', (e) => resolve({ ok: false, msg: e.message }))
  })
}

function pathHas(dir) {
  const sep = process.platform === 'win32' ? ';' : ':'
  return (process.env.PATH || '').split(sep).includes(dir)
}

async function main() {
  const results = []
  results.push(['pdftoppm', await check('pdftoppm', ['-v'])])
  results.push(['tesseract', await check('tesseract')])

  console.log('--- Affluvia OCR Doctor ---')
  for (const [name, res] of results) {
    if (res.ok) console.log(`✔ ${name}: ${res.msg}`)
    else console.log(`✖ ${name}: ${res.msg}`)
  }

  const hints = []
  const brewFound = await check('brew', ['--version'])
  const useBrew = brewFound.ok
  if (!results[0][1].ok || !results[1][1].ok) {
    hints.push('Missing dependencies detected:')
    if (!results[0][1].ok) hints.push('- Install poppler (for pdftoppm)')
    if (!results[1][1].ok) hints.push('- Install tesseract-ocr')
    if (useBrew) {
      hints.push('macOS (Homebrew): brew install poppler tesseract')
    } else {
      hints.push('Ubuntu/Debian: sudo apt-get update && sudo apt-get install -y poppler-utils tesseract-ocr')
    }
  }

  // PATH guidance
  const expects = ['/opt/homebrew/bin', '/usr/local/bin']
  for (const dir of expects) {
    if (!pathHas(dir)) {
      hints.push(`Consider adding ${dir} to PATH (server/bootstrap.ts does this automatically at runtime).`)
    }
  }

  if (hints.length) {
    console.log('\n--- Hints ---')
    for (const h of hints) console.log(h)
  }
}

main().catch((e) => {
  console.error('doctor failed:', e)
  process.exit(1)
})

