import MarkdownIt from '../vendor/markdown-it/markdown-it.esm.min.mjs';

const markdown=new MarkdownIt({html:false,linkify:false,typographer:false});
const escape=value=>markdown.utils.escapeHtml(value);

export function renderFormulaMarkdown(source){
 if(!source.trim()||!/^# 战斗公式\s*$/m.test(source))throw new Error('公式正文格式不正确');
 const tokens=markdown.parse(source,{}),chapters=[];
 let section=0,subsection=0;
 for(let index=0;index<tokens.length;index++){
  const token=tokens[index];
  if(token.type!=='heading_open'||!['h2','h3'].includes(token.tag))continue;
  if(token.tag==='h2'){section++;subsection=0;}else subsection++;
  const id=`formula-${section}${token.tag==='h3'?`-${subsection}`:''}`;
  token.attrSet('id',id);token.attrSet('tabindex','-1');
  const title=tokens[index+1].children.filter(child=>['text','code_inline'].includes(child.type)).map(child=>child.content).join('');
  chapters.push({id,title,level:Number(token.tag.slice(1))});
 }
 if(!chapters.length)throw new Error('公式正文缺少章节');
 const html=markdown.renderer.render(tokens,markdown.options,{});
 const toc=chapters.map(chapter=>`<li class="formula-toc-level-${chapter.level}"><a href="#${chapter.id}">${escape(chapter.title)}</a></li>`).join('');
 return {html,toc,chapters};
}
