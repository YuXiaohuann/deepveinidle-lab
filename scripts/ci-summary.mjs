import fs from 'node:fs/promises';
const directory='.test-artifacts/ci';
async function optional(name){try{return JSON.parse(await fs.readFile(`${directory}/${name}`,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
const deployment=await optional('deployment.json'),check=await optional('check/check.json'),exact=await optional('verify-exact/verify.json'),channel=await optional('verify-channel/verify.json');
const exactAnalytics=exact?.browser?.analytics??(await optional('verify-exact/browser.json'))?.analytics;
const channelAnalytics=channel?.browser?.analytics??(await optional('verify-channel/browser.json'))?.analytics;
const passed=deployment?.status==='uploaded'&&exact?.status==='passed'&&channel?.status==='passed';
const text=`## CI 发布结果\n\n- Job：${process.env.JOB_STATUS}\n- 检查：${check?.status??'未完成'}\n- 版本：${check?.version??'未知'}\n- 提交：${deployment?.sha??process.env.GITHUB_SHA}\n- 输入摘要：${check?.inputs?.id??'未生成'}\n- 部署：${deployment?.status??'未执行'}\n- 精确地址：${deployment?.url??'未获取'}\n- 精确验收：${exact?.status??'未执行'}\n- 通道验收：${channel?.status??'未执行'}\n- 统计脚本：精确地址 ${exact?.analytics??'未执行'}（替代 ${exactAnalytics?.excludedRequests?.length??'未记录'} 次）；通道 ${channel?.analytics??'未执行'}（替代 ${channelAnalytics?.excludedRequests?.length??'未记录'} 次）（exclude 不验证统计可用性）\n- 上线验收：${passed?'通过':'未通过或未执行'}\n\n上传后的失败不表示自动回退。完整证据见本轮 evidence artifact（保留 30 天）。\n`;
await fs.mkdir(directory,{recursive:true});await fs.writeFile(`${directory}/summary.md`,text);await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,text);
