import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
export async function modelConfig() {
  if (process.env.FITPLAN_AI_URL || process.env.FITPLAN_AI_MODEL) {
    return {url:process.env.FITPLAN_AI_URL, model:process.env.FITPLAN_AI_MODEL, key:process.env.FITPLAN_AI_KEY};
  }
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) return {};
  const file = path.join(process.env.LOCALAPPDATA,'Fitplan','deepseek.credential');
  try { await access(file); } catch { return {}; }
  const command = "$ErrorActionPreference='Stop'; $env:PSModulePath=$PSHOME+'\Modules'; $s=Get-Content -Raw -LiteralPath (Join-Path $env:LOCALAPPDATA 'Fitplan/deepseek.credential'); $k=ConvertTo-SecureString ($s.Trim()); [Console]::Write([Net.NetworkCredential]::new('', $k).Password)";
  const {stdout} = await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:10000});
  return {url:'https://api.deepseek.com/chat/completions', model:'deepseek-flash', key:stdout};
}
