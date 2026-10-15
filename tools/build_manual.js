// 操作マニュアル（src/view_manual.html）を作る：node tools/build_manual.js
// 付録A〜Fは docs/prompts の指示文（コードブロック）をそのまま入れる。指示文を直したら、このスクリプトを実行して一緒に保存する（CLAUDE.md の決まり）
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const block = f => { const m = read(f).match(/^```\n([\s\S]*?)\n```$/m); if (!m) throw new Error('コードブロックがない：' + f); return m[1]; };
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const APPENDIX = {
  A: 'docs/prompts/web_work_weekly.md',
  B: 'docs/prompts/project_weekly_analysis.md',
  C: 'docs/prompts/project_morning_brief.md',
  D: 'docs/prompts/desktop_work_ai.md',
  E: 'docs/prompts/desktop_work_ai_daily.md',
  F: 'docs/prompts/web_work_morning.md'
};
function build() {
  let html = read('tools/manual_template.html');
  Object.keys(APPENDIX).forEach(k => { html = html.replace('{{' + k + '}}', () => esc(block(APPENDIX[k]))); });
  return html;
}
module.exports = { build, block, APPENDIX };
if (require.main === module) {
  fs.writeFileSync(path.join(root, 'src/view_manual.html'), build());
  console.log('src/view_manual.html を作りました');
}
