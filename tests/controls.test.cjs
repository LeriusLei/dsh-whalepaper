const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
const defaults={theme:'auto',composition:'balanced',brightness:.97,saturation:1.11,blur:.3,quiet:true,paused:false,enabled:true};
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function setup({loading=false}={}){
  const {window}=parseHTML('<html><head></head><body><input id="chat" value="draft"></body></html>');
  let state,plugin,snapshot={mode:'host',status:loading?'loading':'ready',writable:true,value:loading?undefined:{...defaults},base:{...defaults},revision:0};
  const subs=new Set(),requests=[],storage=new Map(),cleanups=[];
  function emit(patch={}){snapshot={...snapshot,...patch};for(const fn of [...subs])fn();}
  const form={getSnapshot:()=>snapshot,subscribe:fn=>{subs.add(fn);return()=>subs.delete(fn);},mutate:ops=>new Promise((resolve,reject)=>requests.push({ops,resolve,reject}))};
  window.addEventListener('ascii-orca:appearance',e=>state=JSON.parse(JSON.stringify(e.detail)));
  window.__ModuleLoader__={load:({factory})=>plugin=factory()};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../client.js'),'utf8'),{window,document:window.document,URL,console,location:{href:'http://localhost:3010/chat'},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}});
  plugin.apply({effect:fn=>cleanups.push(fn()),inject:(names,callback)=>{if(names[0]==='configForms')callback({configForms:{get:()=>form},effect:fn=>cleanups.push(fn())});}});
  function change(id,value,type){const el=window.document.querySelector('#ascii-orca-'+id);if(el.tagName==='SELECT')el.querySelector(`[value="${value}"]`).selected=true;else if(el.type==='checkbox')el.checked=value;else el.value=String(value);el.dispatchEvent(new window.Event(type||'change',{bubbles:true}));}
  async function accept(){const request=requests.shift();assert(request,'expected a pending host mutation');const next={...snapshot.value};for(const op of request.ops)next[op.path[0]]=op.op==='unset'?defaults[op.path[0]]:op.value;emit({status:'ready',value:next,revision:snapshot.revision+1});request.resolve(true);await tick();return request;}
  return {window,form,requests,emit,change,accept,get state(){return state;},get snapshot(){return snapshot;},stop:()=>cleanups.reverse().forEach(fn=>fn?.())};
}
test('delayed host echoes never undo a drag, checkbox, sibling edit or reset',async()=>{
  const s=setup();s.change('brightness',80);await tick();assert.equal(s.requests.length,1);
  s.change('brightness',61,'input');s.change('saturation',90,'input');s.change('enabled',false);
  s.emit();assert.equal(s.state.brightness,.61,'old host snapshot must not win over the latest slider value');assert.equal(s.state.enabled,false,'checkbox stays disabled while saving');
  await s.accept();assert.equal(s.state.brightness,.61);assert.equal(s.state.enabled,false);assert.equal(s.requests.length,1,'one coalesced successor, not one host call per input');
  await s.accept();assert.equal(s.snapshot.value.brightness,.61);assert.equal(s.snapshot.value.saturation,.9);assert.equal(s.snapshot.value.enabled,false);
  s.change('blur',2.4);await tick();s.window.document.querySelector('#ascii-orca-reset').click();s.change('theme','night');await s.accept();await s.accept();
  assert.equal(s.snapshot.value.brightness,.97);assert.equal(s.snapshot.value.blur,.3);assert.equal(s.snapshot.value.theme,'night','a later edit survives reset');s.stop();
});
test('loading host queues intent; failed saves preserve intent and expose retry',async()=>{
  const s=setup({loading:true});s.change('enabled',false);await tick();assert.equal(s.requests.length,0,'do not write an uninitialized form');
  s.emit({status:'ready',value:{...defaults}});await tick();assert.equal(s.state.enabled,false);assert.equal(s.requests.length,1);await s.accept();
  s.change('composition','golden');await tick();s.requests.shift().resolve(false);await tick();
  assert.equal(s.state.composition,'golden','a failed write must not silently restore the old selection');
  assert.match(s.window.document.querySelector('#ascii-orca-save-status').textContent,/失败|重试/);
  s.window.document.querySelector('#ascii-orca-retry').click();await tick();await s.accept();assert.equal(s.snapshot.value.composition,'golden');s.stop();
});
test('saturation, blur and selects keep exact values across external host changes',async()=>{
  const s=setup();s.change('blur',3.7,'input');s.change('saturation',31,'input');s.change('theme','predawn');await tick();
  s.emit({value:{...defaults,paused:true}});assert.equal(s.state.blur,3.7);assert.equal(s.state.saturation,.31);assert.equal(s.state.theme,'predawn');assert.equal(s.state.paused,true,'unrelated remote fields still propagate');
  await s.accept();assert.equal(s.snapshot.value.blur,3.7);assert.equal(s.window.document.querySelector('#chat').getAttribute('value'),'draft');s.stop();
});
