/* Self-contained DSH browser module (lazy-CJS): the loader materializes the
 * factory once and later plugs the returned exports. One appearance
 * implementation serves the real Harness and the local preview: settings come
 * from the Harness config form when served, else from localStorage (preview). */
window.__ModuleLoader__.load({ id: 'dsh-whalepaper', factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;

  var NAMESPACE = 'dsh-whalepaper';
  var preview = document.documentElement.hasAttribute('data-orca-preview');
  var storageKey = 'dsh-whalepaper:v1' + (preview ? ':preview-v2' : '');
  var themes = ['auto','night','predawn','sunrise','day','afternoon','golden','sunset','dusk'];
  var compositions = ['immersive','balanced','golden'];
  // Keep these accepted defaults in sync with default-settings.json (release test).
  var defaults = { theme:'auto', composition:'balanced', brightness:.97, saturation:1.11, blur:.3, quiet:true, paused:false, enabled:true };
  var FIELD_KEYS = ['enabled','paused','quiet','theme','composition','brightness','saturation','blur'];
  var THEME_LABELS = { auto:'随当地时间', night:'深夜 · 月下深蓝', predawn:'凌晨 · 薰紫薄雾', sunrise:'日出 · 杏金晨光', day:'正午 · 晴空碧海', afternoon:'下午 · 青金波光', golden:'黄昏 · 金色时刻', sunset:'晚霞 · 桃金云海', dusk:'傍晚 · 蓝调暮色' };
  var COMPOSITION_LABELS = { immersive:'28% 水上', balanced:'33% 水上 · 默认', golden:'38.2% 水上' };
  var number = (value, fallback, min, max) => typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
  var normalize = raw => ({
    theme:themes.includes(raw?.theme)?raw.theme:defaults.theme,
    composition:compositions.includes(raw?.composition)?raw.composition:defaults.composition,
    enabled:raw?.enabled!==false, paused:raw?.paused===true, quiet:raw?.quiet!==false,
    brightness:number(raw?.brightness,defaults.brightness,.60,1),
    saturation:number(raw?.saturation,defaults.saturation,.30,1.15), blur:Math.round(number(raw?.blur,defaults.blur,0,4)*10)/10,
  });

  /* Settings store: the Harness config form is the source of truth when the
   * Host serves one (writes land in the profile patch and hot-apply); otherwise
   * localStorage keeps the standalone preview working. */
  function readLocal() {
    try { return normalize(JSON.parse(localStorage.getItem(storageKey) ?? 'null')); } catch { return normalize(defaults); }
  }
  function createStore() {
    var form = null, off = null, local = readLocal(), listeners = [], cache = null;
    var edits = new Map(), sequence = 0, generation = 0, flight = null, queued = false, blocked = false, error = '', waiters = [];
    function notify() { cache = null; for (var fn of listeners.slice()) { try { fn(); } catch (error) { console.error('[whalepaper] settings listener failed', error); } } }
    function native() { return !!(form && form.getSnapshot && form.getSnapshot().mode === 'host'); }
    function snapshot() {
      var base = local;
      if (form && form.getSnapshot) {
        var current = form.getSnapshot();
        if (current.status === 'ready' && current.value) base = normalize(current.value);
      }
      var next = { ...base };
      for (var [key, edit] of edits) next[key] = edit.value;
      return normalize(next);
    }
    function get() { if (!cache) cache = snapshot(); return cache; }
    function status() {
      if (error) return error;
      if (native()) {
        if (edits.size || flight) return '正在保存…';
        return form.getSnapshot().status === 'ready' ? '设置已保存到当前 profile' : '正在加载宿主设置…';
      }
      return '本地预览：设置已保存在浏览器';
    }
    function reconcile() {
      var value = form?.getSnapshot?.().value;
      if (!value) return;
      for (var [key, edit] of edits) if (edit.accepted && value[key] === edit.value) edits.delete(key);
    }
    function onHostChange() { reconcile(); notify(); queue(); }
    function queue() {
      if (queued || flight || blocked || !native()) return;
      queued = true;
      Promise.resolve().then(() => { queued = false; pump(); });
    }
    function pump() {
      if (flight || blocked || !native()) return;
      var current = form.getSnapshot();
      if (current.status !== 'ready') return;
      if (current.writable === false) { error = '保存失败：当前设置只读，请检查宿主权限后重试'; blocked = true; notify(); return; }
      var batch = [...edits].filter(([, edit]) => !edit.accepted);
      if (!batch.length) return;
      var target = form, epoch = generation;
      var token = { batch, through: Math.max(...batch.map(([, edit]) => edit.seq)) };
      flight = token;
      var ops = batch.map(([key, edit]) => edit.unset ? { op:'unset', path:[key] } : { op:'set', path:[key], value:edit.value });
      Promise.resolve().then(() => target.mutate(ops)).then(ok => finish(ok === true), () => finish(false));
      function finish(ok) {
        if (generation !== epoch || flight !== token) return;
        flight = null;
        if (ok) {
          for (var [key, sent] of batch) if (edits.get(key)?.seq === sent.seq) edits.set(key, { ...sent, accepted:true });
          reconcile(); error = '';
        } else { blocked = true; error = '保存失败，当前调整已保留，请重试保存'; }
        var settled = waiters.filter(w => w.seq <= token.through); waiters = waiters.filter(w => w.seq > token.through);
        for (var waiter of settled) waiter.resolve(ok);
        local = snapshot(); persistLocal(); notify(); queue();
      }
    }
    function attach(next) {
      if (!next || form === next) return;
      off?.(); generation++; flight = null; form = next; blocked = false; error = '';
      if (typeof next.subscribe === 'function') off = next.subscribe(onHostChange);
      onHostChange();
    }
    function detach(next) {
      if (form !== next) return;
      try { off?.(); } catch {}
      local = get(); off = null; form = null; generation++; flight = null; notify();
    }
    function persistLocal() { try { localStorage.setItem(storageKey, JSON.stringify(local)); } catch {} }
    function write(patch) {
      if (native()) {
        var next = normalize({ ...get(), ...patch });
        for (var key of FIELD_KEYS) if (Object.prototype.hasOwnProperty.call(patch, key)) edits.set(key, { value:next[key], seq:++sequence, accepted:false });
        local = next; persistLocal(); blocked = false; error = ''; notify();
        var result = new Promise(resolve => waiters.push({ seq:sequence, resolve })); queue(); return result;
      }
      local = normalize({ ...get(), ...patch }); for (var key of Object.keys(patch)) edits.delete(key); persistLocal(); notify(); return Promise.resolve(true);
    }
    function reset() {
      if (native()) {
        var base = normalize(form.getSnapshot().base || defaults);
        for (var key of FIELD_KEYS) edits.set(key, { value:base[key], seq:++sequence, unset:true, accepted:false });
        local = base; persistLocal(); blocked = false; error = ''; notify();
        var result = new Promise(resolve => waiters.push({ seq:sequence, resolve })); queue(); return result;
      }
      edits.clear(); local = normalize(defaults); persistLocal(); notify(); return Promise.resolve(true);
    }
    return {
      get, write, reset, attach, detach, status,
      failed: () => !!error,
      retry() { blocked = false; error = ''; notify(); queue(); },
      native,
      subscribe(fn) { listeners.push(fn); return () => { listeners = listeners.filter(item => item !== fn); }; },
    };
  }
  var store = createStore();

  // Optimistic values live in the shared store immediately. One Host write may
  // be in flight; newer per-field edits coalesce behind it and mask old echoes.
  function scheduleWrite(patch) {
    return store.write(patch);
  }
  function cancelPendingWrite() { /* Unmount must not discard accepted user intent. */ }
  // Commit immediately, but never drop a debounced slider value that is still
  // pending: a checkbox/select edit in the same frame must include it.
  function flushWrite(patch) {
    return store.write(patch);
  }

  /* Native settings card, contributed to 插件 → 配置 as well as the bundle
   * detail page. It renders the same store the wallpaper mounts, so the profile
   * patch stays the single source of truth. */
  function createCard(react) {
    var h = react.createElement;
    var labelStyle = { color:'var(--dsw-alias-label-primary, inherit)', fontSize:'13px' };
    var hintStyle = { color:'var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary, inherit))', fontSize:'12px', lineHeight:'1.5' };
    var rowStyle = { display:'flex', alignItems:'center', justifyContent:'space-between', gap:'16px', padding:'10px 0', borderTop:'1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.35))' };
    var selectStyle = { WebkitAppRegion:'no-drag', pointerEvents:'auto', minHeight:'30px', maxWidth:'220px', padding:'4px 8px', font:'inherit', fontSize:'13px', color:'inherit', background:'var(--dsw-alias-bg-layer-2, rgba(127,127,127,.08))', border:'1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.45))', borderRadius:'6px' };
    var buttonStyle = { WebkitAppRegion:'no-drag', pointerEvents:'auto', appearance:'none', minHeight:'30px', padding:'4px 12px', font:'inherit', fontSize:'13px', color:'inherit', background:'transparent', border:'1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.45))', borderRadius:'6px', cursor:'pointer' };
    var outputStyle = { width:'58px', textAlign:'right', fontVariantNumeric:'tabular-nums', fontSize:'12px', color:'var(--dsw-alias-label-secondary, inherit)' };
    var inputStyle = { width:'168px', accentColor:'var(--dsw-alias-brand-fill, #7aa7c7)', WebkitAppRegion:'no-drag', pointerEvents:'auto', touchAction:'none' };
    function title(key, label, hint) {
      return h('div', { key:key + ':label', style:{ display:'flex', flexDirection:'column', gap:'2px', minWidth:'0' } },
        h('span', { style:labelStyle }, label), hint ? h('span', { style:hintStyle }, hint) : null);
    }
    function row(key, label, hint, control) { return h('div', { key, style:rowStyle }, title(key, label, hint), control); }
    function options(table, order) { return order.map(item => h('option', { key:item, value:item }, table[item] ?? item)); }
    return function WhalePaperCard() {
      var pair = react.useState(store.get()), state = pair[0], setState = pair[1];
      react.useEffect(() => { const off=store.subscribe(() => setState(store.get()));setState(store.get());return off; }, []);
      function commit(patch, soon) {
        setState(previous => ({ ...previous, ...patch }));
        if (soon) scheduleWrite(patch);
        else store.write(patch);
      }
      function field(key, value, soon) {
        var patch = {}; patch[key] = value;
        commit(patch, soon);
      }
      function rangeRow(key, label, hint, min, max, step) {
        var shown = key === 'blur' ? state[key].toFixed(1) + 'px' : Math.round(state[key] * 100) + '%';
        return row(key, label, hint, h('span', { style:{ display:'flex', alignItems:'center', gap:'8px' } },
          h('input', { id:'orca-card-'+key, 'aria-label':label, type:'range', min, max, step, value:key === 'blur' ? state[key] : Math.round(state[key] * 100), style:inputStyle,
            onChange: event => field(key, key === 'blur' ? Number(event.target.value) : Number(event.target.value) / 100, true) }),
          h('output', { style:outputStyle }, shown)));
      }
      function checkboxRow(key, label, hint) {
        return row(key, label, hint, h('input', { id:'orca-card-'+key, 'aria-label':label, style:{WebkitAppRegion:'no-drag',pointerEvents:'auto'}, type:'checkbox', checked:state[key] === true, onChange:event => field(key, event.target.checked) }));
      }
      return h('section', { style:{ display:'flex', flexDirection:'column', fontSize:'13px', color:'var(--dsw-alias-label-primary, inherit)' } },
        h('p', { style:{ margin:'0 0 4px', color:'var(--dsw-alias-label-secondary, inherit)', fontSize:'12px', lineHeight:'1.7' } },
          '默认参数已适配 Harness：33% 水上、亮度 97%、饱和度 111%、柔化 0.3px。下面的调整会写入当前 profile 并立即生效；右下角浮动按钮 ≈ 是同一组设置的快捷入口，两边保持同步。'),
        row('theme', '海洋时刻', 'auto 跟随系统时间',
          h('select', { value:state.theme, style:selectStyle, onChange:event => field('theme', event.target.value) }, options(THEME_LABELS, themes))),
        row('composition', '海天比例', '水上占比',
          h('select', { value:state.composition, style:selectStyle, onChange:event => field('composition', event.target.value) }, options(COMPOSITION_LABELS, compositions))),
        rangeRow('brightness', '壁纸亮度', '只作用于壁纸，文字与输入保持清晰', 60, 100, 1),
        rangeRow('saturation', '壁纸饱和度', null, 30, 115, 1),
        rangeRow('blur', '壁纸柔化', '单位像素，0 为不柔化', 0, 4, 0.1),
        checkboxRow('enabled', '显示壁纸', '关闭后恢复纯色界面'),
        checkboxRow('quiet', '安静游动', '降低洋流与鲸群的动画幅度'),
        checkboxRow('paused', '暂停动画', '定格当前画面'),
        h('div', { style:{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap', paddingTop:'14px', borderTop:'1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.35))' } },
          h('button', { type:'button', style:buttonStyle, onClick:() => { store.reset().then(() => setState(store.get())); } }, '恢复默认参数'),
          h('span', { role:'status', style:{ ...hintStyle, fontSize:'12px' } }, store.status()),
          store.failed() ? h('button', { type:'button', style:buttonStyle, onClick:() => store.retry() }, '重试保存') : null));
    };
  }

  /* Wallpaper surface. */
  function mount(services) {
    let stopped=false,state=store.get(),tokenDispose;
    const attr='data-ascii-orca-wallpaper',previousAttr=document.documentElement.getAttribute(attr),previousIsolation=document.body.style.isolation;
    // Some shell plugins (for example codex-ui) paint their own opaque sidebar
    // surface. They expose a glass mode switched on by this body attribute; we
    // take it over while the wallpaper is visible and restore it afterwards.
    const sidebarGlassBefore=document.body.getAttribute('data-we-sidebar-glass');
    const frame=document.createElement('iframe');frame.id='ascii-orca-background';frame.title='ASCII Orca ocean wallpaper';frame.tabIndex=-1;
    frame.setAttribute('aria-hidden','true');frame.setAttribute('sandbox','allow-scripts allow-same-origin');
    // A host with an opaque title/preview bar can reserve its actual height.
    // ResizeObserver in the embedded engine then recomputes the sky/water view.
    frame.style.cssText='position:fixed;inset:var(--orca-top-inset,0px) 0 0;width:100%;height:calc(100% - var(--orca-top-inset,0px));border:0;pointer-events:none;z-index:-1;';
    const assetUrl=new URL(preview?'./index.html':'/ascii-orca/index.html',location.href);
    for(const key of ['theme','composition'])assetUrl.searchParams.set(key,state[key]);
    assetUrl.searchParams.set('motion',state.quiet?'0.72':'1');frame.src=assetUrl.href;
    const style=document.createElement('style');style.id='ascii-orca-host-style';
    const variables=document.createElement('style');variables.id='ascii-orca-values';
    // Only paint/colour properties are changed. No widths, DOM chat content,
    // scroll containers, drag regions, text opacity or text/font tokens.
    style.textContent=`
html[${attr}],html[${attr}] body,html[${attr}] #root{background:transparent!important}
html[${attr}] .dcu-root{background:transparent!important}
html[${attr}] .dcu-root::before{pointer-events:none}
html[${attr}] body{--we-sidebar-blur:12px;--we-sidebar-saturate:1.2;--we-sidebar-alpha:1.35;--we-sidebar-sheen:.45;--we-sidebar-color:#0b1622}
html[${attr}] body:not([data-ds-dark-theme]){--we-sidebar-color:#f8fafc;--we-sidebar-alpha:.55;--we-sidebar-sheen:.5}
#ascii-orca-background{filter:brightness(var(--orca-brightness)) saturate(var(--orca-saturation)) blur(var(--orca-blur));transform:scale(1.006);transform-origin:center}
html[${attr}] #root div:has(>[data-shell-overlay]){background:transparent!important}
html[${attr}] #root div:has(>[data-shell-overlay])>div:has(+[data-rightbar-col]){background:transparent!important}
html[${attr}] #root [data-phase]:has(>[data-conversation-content]){background:transparent!important}
html[${attr}] #root :is([data-conversation-content],[data-composer-seat],[data-composer-card],pre){background:transparent!important;background-image:none!important}
html[${attr}] #root [data-phase]>:has([data-conversation-header-corner]){background:transparent!important}
html[${attr}] :is([role=dialog],[role=menu],[data-trigger-menu]){background-color:var(--dsw-alias-bg-layer-1)!important}
html[data-orca-preview][${attr}] :is(.preview-sidebar,.conversation-header,.user-message,.code-block,.code-title,.session.active){background:transparent!important}
html[data-orca-preview][${attr}] .markdown,html[data-orca-preview][${attr}] .speaker,html[data-orca-preview][${attr}] .sidebar-title{text-shadow:0 1px 3px rgba(0,0,0,.7)}
#ascii-orca-controls{position:fixed;right:12px;bottom:10px;z-index:30;font:12px/1.6 system-ui,sans-serif;color:#edf2f7;pointer-events:none;-webkit-app-region:no-drag}
#ascii-orca-controls button,#ascii-orca-controls select,#ascii-orca-panel{pointer-events:auto}
#ascii-orca-controls button,#ascii-orca-controls select{font:inherit;color:inherit;background:#182738;border:1px solid #536477;border-radius:6px;min-height:34px;cursor:pointer}
#ascii-orca-controls>button{width:32px;min-height:30px;font-size:19px;color:#d2e0e9;background:rgba(20,31,45,.88)}
#ascii-orca-panel{position:absolute;right:0;bottom:42px;width:min(318px,calc(100vw - 24px));max-height:calc(100dvh - 100px);overflow:auto;padding:18px;background:#101c2a;border:1px solid #46586d;border-radius:12px;box-shadow:0 15px 50px #0006}
#ascii-orca-panel[hidden]{display:none}#ascii-orca-panel h2{font-size:15px;margin:0 0 16px;font-weight:500}
#ascii-orca-panel input,#ascii-orca-panel select,#ascii-orca-panel button{pointer-events:auto;-webkit-app-region:no-drag;touch-action:manipulation}
#ascii-orca-panel input[type=range]{touch-action:none}
#ascii-orca-panel label{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0}#ascii-orca-panel select{padding:4px 7px;max-width:176px}#ascii-orca-panel input[type=range]{width:112px;accent-color:#a7bfd2}#ascii-orca-panel output{display:inline-block;width:35px;text-align:right;font-variant-numeric:tabular-nums;color:#b5c5d5}#ascii-orca-panel .orca-range{display:flex;align-items:center;gap:5px}#ascii-orca-panel small{display:block;color:#b4c2d0;line-height:1.8;margin-top:14px}#ascii-orca-panel hr{border:0;border-top:1px solid #344459;margin:14px 0}
#ascii-orca-controls :focus-visible{outline:2px solid #d0e4f3;outline-offset:3px}
`;
    const controls=document.createElement('div');controls.id='ascii-orca-controls';
    const range=(id,label,min,max,step)=>`<label>${label}<span class="orca-range"><input id="ascii-orca-${id}" aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}"><output id="ascii-orca-${id}-value"></output></span></label>`;
    controls.innerHTML='<button type="button" id="ascii-orca-toggle" aria-label="海洋壁纸设置" aria-expanded="false" title="海洋壁纸设置">≈</button><section id="ascii-orca-panel" aria-label="海洋壁纸设置" hidden><h2>潮汐之间 · Harness 适配</h2><label>海洋时刻<select id="ascii-orca-theme"><option value="auto">随当地时间</option><option value="night">深夜 · 月下深蓝</option><option value="predawn">凌晨 · 薰紫薄雾</option><option value="sunrise">日出 · 杏金晨光</option><option value="day">正午 · 晴空碧海</option><option value="afternoon">下午 · 青金波光</option><option value="golden">黄昏 · 金色时刻</option><option value="sunset">晚霞 · 桃金云海</option><option value="dusk">傍晚 · 蓝调暮色</option></select></label><label>海天比例<select id="ascii-orca-composition"><option value="immersive">28% 水上</option><option value="balanced">33% 水上 · 默认</option><option value="golden">38.2% 水上</option></select></label><hr>'+range('brightness','壁纸亮度',60,100,1)+range('saturation','壁纸饱和度',30,115,1)+range('blur','壁纸柔化',0,4,.1)+'<hr><label>安静游动<input id="ascii-orca-quiet" type="checkbox"></label><label>暂停动画<input id="ascii-orca-paused" type="checkbox"></label><label>显示壁纸<input id="ascii-orca-enabled" type="checkbox"></label><button type="button" id="ascii-orca-reset">恢复默认参数</button><small>滤镜只作用于壁纸，文字与输入保持清晰。设置保存到当前 profile；同一组参数也可在 插件 → 配置 中调整。</small></section>';
    const panel=controls.querySelector('#ascii-orca-panel'),toggle=controls.querySelector('#ascii-orca-toggle');
    const saveStatus=document.createElement('small');saveStatus.id='ascii-orca-save-status';saveStatus.setAttribute('role','status');
    const retry=document.createElement('button');retry.id='ascii-orca-retry';retry.type='button';retry.textContent='重试保存';retry.hidden=true;
    panel.append(saveStatus,retry);
    const onRetry=()=>store.retry();retry.addEventListener('click',onRetry);
    const fields=Object.fromEntries(['theme','composition','brightness','saturation','blur','quiet','paused','enabled'].map(key=>[key,controls.querySelector('#ascii-orca-'+key)]));
    function sync(){saveStatus.textContent=store.status();retry.hidden=!store.failed();for(const key of ['theme','composition'])if(fields[key].value!==state[key])fields[key].value=state[key];for(const key of ['quiet','paused','enabled'])fields[key].checked=state[key];for(const key of ['brightness','saturation','blur']){const value=String(key==='blur'?state[key]:Math.round(state[key]*100));if(fields[key].value!==value)fields[key].value=value;controls.querySelector('#ascii-orca-'+key+'-value').textContent=key==='blur'?state[key].toFixed(1)+'px':Math.round(state[key]*100)+'%';}}
    const send=()=>{if(stopped||!frame.contentWindow)return;const origin=new URL(frame.src).origin;frame.contentWindow.postMessage({type:'ascii-orca:configure',theme:state.theme,composition:state.composition,motionScale:state.quiet ? 0.72 : 1,paused:state.paused||!state.enabled||document.hidden},origin==='null'?'*':origin);};
    const emit=()=>window.dispatchEvent(new window.CustomEvent('ascii-orca:appearance',{detail:{...state}}));
    function settleSidebarGlass(){
      if(sidebarGlassBefore===null)document.body.removeAttribute('data-we-sidebar-glass');else document.body.setAttribute('data-we-sidebar-glass',sidebarGlassBefore);
    }
    function project(){
      if(stopped)return;
      variables.textContent=`html[${attr}]{--orca-brightness:${state.brightness};--orca-saturation:${state.saturation};--orca-blur:${state.blur}px}`;
      if(state.enabled){document.documentElement.setAttribute(attr,'');document.body.setAttribute('data-we-sidebar-glass','');document.body.style.isolation='isolate';if(!frame.isConnected)document.body.prepend(frame);
        if(!tokenDispose){const theme=services.theme;tokenDispose=theme&&typeof theme.overrideTokens==='function'?theme.overrideTokens(NAMESPACE,{'--dsw-specific-sidebar-fill':{light:'transparent',dark:'transparent'}}):undefined;}
      }else{document.documentElement.removeAttribute(attr);settleSidebarGlass();frame.remove();document.body.style.isolation=previousIsolation;tokenDispose?.();tokenDispose=undefined;}
      send();emit();
    }
    // Each control writes only its own field. Never serialize the whole panel
    // here: a stale sibling value must not overwrite a newer edit that arrived
    // through the native settings card (or the other way around).
    function save(event){
      const id=event?.target?.id??'';
      let patch=null;
      if(id==='ascii-orca-theme')patch={theme:fields.theme.value};
      else if(id==='ascii-orca-composition')patch={composition:fields.composition.value};
      else if(id==='ascii-orca-quiet')patch={quiet:fields.quiet.checked};
      else if(id==='ascii-orca-paused')patch={paused:fields.paused.checked};
      else if(id==='ascii-orca-enabled')patch={enabled:fields.enabled.checked};
      else if(id==='ascii-orca-brightness')patch={brightness:Number(fields.brightness.value)/100};
      else if(id==='ascii-orca-saturation')patch={saturation:Number(fields.saturation.value)/100};
      else if(id==='ascii-orca-blur')patch={blur:Number(fields.blur.value)};
      if(!patch)return;
      state=normalize({...state,...patch});sync();project();
      if(event?.target?.type==='range'&&event.type==='input'){scheduleWrite(patch);}else flushWrite(patch);
    }
    const onInput=event=>{if(event.target?.type==='range')save(event);};
    const onReset=()=>{cancelPendingWrite();store.reset();};
    const reset=controls.querySelector('#ascii-orca-reset');
    const onToggle=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)fields.theme.focus();};
    const onKey=event=>{if(event.key==='Escape'&&!panel.hidden){panel.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();}};
    const unsubscribe=store.subscribe(function(){if(stopped)return;state=store.get();sync();project();});
    const onVisibilityChange=()=>send();
    reset.addEventListener('click',onReset);frame.addEventListener('load',send);toggle.addEventListener('click',onToggle);controls.addEventListener('change',save);controls.addEventListener('input',onInput);controls.addEventListener('keydown',onKey);document.addEventListener('visibilitychange',onVisibilityChange);
    document.head.append(style,variables);document.body.append(controls);sync();project();
    return {
      stop() {
        if(stopped)return;stopped=true;cancelPendingWrite();unsubscribe();
        retry.removeEventListener('click',onRetry);reset.removeEventListener('click',onReset);frame.removeEventListener('load',send);toggle.removeEventListener('click',onToggle);controls.removeEventListener('change',save);controls.removeEventListener('input',onInput);controls.removeEventListener('keydown',onKey);document.removeEventListener('visibilitychange',onVisibilityChange);
        frame.src='about:blank';frame.remove();controls.remove();style.remove();variables.remove();tokenDispose?.();tokenDispose=undefined;settleSidebarGlass();
        if(previousAttr===null)document.documentElement.removeAttribute(attr);else document.documentElement.setAttribute(attr,previousAttr);
        document.body.style.isolation=previousIsolation;
      },
      refresh() { if(stopped)return; state=store.get(); sync(); project(); },
    };

  }

  /* Contribute the settings card to the Plugins page and to the row page.
   * dsh 0.1.7+ keys plugins.bundle.config by the BUNDLE's package name; the
   * row key is `${bundle}#${rowId}`, and this bundle inserts its own entry id
   * (equal to the package name), so both keys are known without host help. */
  function registerCard(ctx) {
    if (!ctx.slots || typeof ctx.slots.inject !== 'function') return;
    var react;
    try { react = require('react'); } catch (error) { console.error('[whalepaper] settings card needs the shared React module', error); return; }
    if (!react || typeof react.createElement !== 'function') return;
    var Card = createCard(react);
    ctx.slots.inject('plugins.bundle.config', function* () {
      yield ctx.slots.register({ name:'plugins.bundle.config', key:NAMESPACE }, Card);
    });
    ctx.slots.inject('plugins.row.config', function* () {
      yield ctx.slots.register({ name:'plugins.row.config', key:NAMESPACE + '#' + NAMESPACE }, Card);
    });
  }

  var active = null;
  function apply(ctx) {
    if (active) { try { active.stop(); } catch (error) { console.error('[whalepaper] stale mount cleanup failed', error); } active = null; }
    var services = { theme: null };
    // Test/preview harnesses hand the adapter a plain `theme` property. A real
    // Cordis context only exposes declared services, so never read `ctx.theme`
    // there: the injected scope below supplies it once it is available.
    if (typeof ctx.inject !== 'function') {
      try { services.theme = ctx.theme || null; } catch (error) { services.theme = null; }
    }
    var mounted = mount(services);
    active = mounted;
    ctx.effect(() => () => {
      try { mounted.stop(); } catch (error) { console.error('[whalepaper] unmount failed', error); }
      if (active === mounted) active = null;
    }, 'whalepaper: owned wallpaper lifecycle');
    if (typeof ctx.inject !== 'function') return;
    // The shared config form is optional: without it the preview/localStorage
    // mirror keeps working, and on a served page the form becomes the source.
    ctx.inject(['configForms'], (scope) => {
      scope.effect(() => {
        var form = scope.configForms.get(NAMESPACE);
        store.attach(form);
        return () => store.detach(form);
      }, 'whalepaper: shared configuration form');
    });
    ctx.inject(['theme'], (scope) => { services.theme = scope.theme; mounted.refresh(); });
    ctx.inject(['slots'], (scope) => { registerCard(scope); });
  }

  exports.apply = apply;
  exports.inject = [];
  return module.exports;
} });
