// 从 build-assets/sheep.svg 再生成托盘/应用图标到 build/。
//
// 图标 PNG 已随仓库提交，开箱即用——本脚本仅在你修改了 sheep.svg 后用于再生成。
// 依赖系统的 `rsvg-convert`（macOS: `brew install librsvg`）；缺失则跳过（不报错）。
//
// 产物：
//   build/trayTemplate.png(16) + @2x(32)  纯黑模板图（macOS 菜单栏，自动反色）
//   build/tray.png(32)                     emerald 彩色（Windows 任务栏）
//   build/icon.png(512)                    应用图标源（electron-builder 据此生成 icns/ico）
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const root = path.join(__dirname, '..')
const svg = path.join(root, 'build-assets', 'sheep.svg')
const outDir = path.join(root, 'build')

function hasRsvg() {
  try {
    execFileSync('rsvg-convert', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

if (!hasRsvg()) {
  console.log('[gen-icon] 未检测到 rsvg-convert，跳过再生成（使用已提交的 build/*.png）。')
  process.exit(0)
}

fs.mkdirSync(outDir, { recursive: true })
const render = (src, size, out) =>
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), src, '-o', out])

// macOS 模板图：原 SVG 即纯黑
render(svg, 16, path.join(outDir, 'trayTemplate.png'))
render(svg, 32, path.join(outDir, 'trayTemplate@2x.png'))

// Windows 彩色 + 应用图标：把填充替换为 emerald
const emerald = path.join(os.tmpdir(), 'sheep-emerald.svg')
fs.writeFileSync(emerald, fs.readFileSync(svg, 'utf8').replace(/#000000/g, '#34d399'))
render(emerald, 32, path.join(outDir, 'tray.png'))
render(emerald, 512, path.join(outDir, 'icon.png'))
fs.rmSync(emerald, { force: true })

console.log('[gen-icon] 已从 sheep.svg 再生成 build/ 下托盘与应用图标。')
