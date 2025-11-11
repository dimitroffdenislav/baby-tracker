import {
  addEntry, deleteEntry, updateEntry, listenEntries, getEntry,
  addSleep, deleteSleep, updateSleep, listenSleep, getSleepEntry,
  addPump, deletePump, updatePump, listenPump, getPumpEntry,
  getAllEntries // НОВО от db.js
} from './db.js';
import { login, logout } from './auth.js';
import { auth } from './firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const $ = sel => document.querySelector(sel);
const today = () => new Date().toISOString().split('T')[0];
const isTrue = v => [true, '✅', 'Да'].includes(v);
const cell = (val, label) => `<td data-label="${label}">${val}</td>`;
const buttons = (id, edit) => `
  <td class="table__cell">
    <button class="table__edit" onclick="toggleEdit('${id}')">${edit ? '💾' : '✏️'}</button>
    <button class="table__delete" onclick="del('${id}')">🗑️</button>
  </td>`;

/* ---------- INGREDIENTS ---------- */
const INGREDIENTS = [
  'морков','тиква','картоф','сладък картоф','пащърнак','целина (корен)','целина (стъбла)','ряпа','колраби',
  'червено цвекло','топинамбур','тиквичка','краставица','зелен боб','зелен грах','царевица',
  'карфиол','броколи','брюкселско зеле','бяло зеле','кисело зеле','коприва','спанак','манголд','лапад',
  'домaт','чушка (сладка)','патладжан','праз','лук','чесън','гъби (печурка)',
  'ябълка','круша','дюля','райска ябълка','банан','киви','смокиня','грозде (бяло)','грозде (червено)',
  'диня','пъпеш','праскова','кайсия','слива','череша','вишна','мушмула','ягода','боровинка','малина',
  'къпина','касис','цариградско грозде',
  'ориз','оризова каша','овесени ядки','овесена каша','ечемик','грис','булгур','кус-кус','просо',
  'елда','киноа','амарант','полента','червена леща','кафява леща','нахут','бял боб','бакла',
  'кисело мляко','кефир','извара','рикота','сирене (обезсолено)','маскарпоне',
  'яйчен жълтък','цяло яйце (терм.)',
  'тахан (сусамов)','фъстъчено масло (гладко)','бадемово масло (гладко)','ленено семе (смляно)','чия (накисната)',
  'зехтин','масло','гхи','слънчогледово олио (студенопресовано)','рапично олио',
  'пилешко','пуешко','заешко','телешко','агнешко','свинско (постно)','черен дроб',
  'сьомга','пъстърва','бяла риба','хек','треска','скумрия','сардина','тон','карагьоз','шаран',
  'копър','магданоз','мащерка','риган','ванилия (нат.)','костен бульон (безсолен)','ябълков пектин'
];

let pureeItems = [];

/* ---------- Lifetime solids (уникални пюрета за целия период) ---------- */
const LIFETIME_SOLIDS_KEY = 'bt_lifetimeSolids';
let lifetimeSolids = {};
try {
  const stored = localStorage.getItem(LIFETIME_SOLIDS_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object') {
      lifetimeSolids = parsed;
    }
  }
} catch (e) {
  lifetimeSolids = {};
}

const saveLifetimeSolids = () => {
  try {
    localStorage.setItem(LIFETIME_SOLIDS_KEY, JSON.stringify(lifetimeSolids));
  } catch (e) {
    // ignore
  }
};

/**
 * Взима име като "Грах + Тиквичка + броколи"
 * и връща ['Грах','Тиквичка','броколи'] – ползваме за lifetime списъка.
 */
const extractIngredients = (rawName) => {
  if (!rawName) return [];
  return rawName
    .split(/[+,]/)          // делим по + и запетая
    .map(s => s.trim())
    .filter(Boolean);
};

// чете всички хранения от Firestore и построява lifetimeSolids от НУЛА
const rebuildLifetimeSolidsFromHistory = async (uid) => {
  try {
    const allEntries = await getAllEntries(uid);
    const map = {};

    allEntries.forEach(e => {
      (e.solids || []).forEach(s => {
        const parts = extractIngredients(s && s.name);
        parts.forEach(p => {
          const key = p && p.trim();
          if (!key) return;
          // броим колко ПЪТИ е срещната тази съставка
          map[key] = (map[key] || 0) + 1;
        });
      });
    });

    lifetimeSolids = map;    // вече е { 'Броколи': 10, 'Грах': 5, ... }
    saveLifetimeSolids();
  } catch (err) {
    console.error('Грешка при зареждане на старите храни:', err);
  }
};


/* ---------- Elements ---------- */
const els = {
  auth:   $('#authSection'),
  app:    $('#appSection'),
  // Feeding
  form:   $('#entryForm'),
  table:  $('#dataTable'),
  summary:$('#summary'),
  // Sleep
  sleepForm:    $('#sleepForm'),
  sleepTable:   $('#sleepTable'),
  sleepSummary: $('#sleepSummary'),
  // Pumps
  pumpForm:    $('#pumpForm'),
  pumpTable:   $('#pumpTable'),
  pumpSummary: $('#pumpSummary'),
  // Shared
  date:   $('input[name=date]'),
  login:  $('#loginBtn'),
  logout: $('#logoutBtn'),
  // Tabs
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabs:    document.querySelectorAll('.tab')
};

let unsubscribe = null;
let sleepUnsub  = null;
let pumpUnsub   = null;
let uid = null;

/* ---------- Tabs ---------- */
els.tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    els.tabBtns.forEach(b => b.classList.remove('is-active'));
    els.tabs.forEach(t => t.classList.remove('is-active'));
    btn.classList.add('is-active');
    document.getElementById(btn.dataset.tab).classList.add('is-active');
  });
});

/* ---------- Puree UI (чете от HTML) ---------- */
const $pureeName = $('#pureeName');
const $pureeQty  = $('#pureeQty');
const $addPuree  = $('#addPuree');
const $pureeList = $('#pureeList');
const $solidsHid = $('#solidsJson');
const $datalist  = $('#ingredients');
const vitaminLabel = $('#vitaminDLabel');
const vitaminCheckbox = vitaminLabel ? vitaminLabel.querySelector('input[name="vitaminD"]') : null;

if ($datalist) {
  $datalist.innerHTML = INGREDIENTS.map(x => `<option value="${x}">`).join('');
}

function renderPureeList() {
  $pureeList.innerHTML = pureeItems.length
    ? pureeItems.map((it, i) =>
        `<li>
           <span>${it.name} — <strong>${it.grams}г</strong></span>
           <button type="button" class="puree__remove" data-i="${i}">✖</button>
         </li>`).join('')
    : '<li class="is-muted">Няма добавени съставки</li>';
  $solidsHid.value = JSON.stringify(pureeItems);
}

$addPuree?.addEventListener('click', () => {
  const name = ($pureeName.value || '').trim();
  const grams = parseInt($pureeQty.value, 10) || 0;
  if (!name || grams <= 0) return;
  pureeItems.push({ name, grams });
  $pureeName.value = '';
  $pureeQty.value = '';
  renderPureeList();
});

$pureeList?.addEventListener('click', (e) => {
  const btn = e.target.closest('.puree__remove');
  if (!btn) return;
  const i = Number(btn.dataset.i);
  if (!Number.isNaN(i)) {
    pureeItems.splice(i, 1);
    renderPureeList();
  }
});

els.form?.addEventListener('reset', () => {
  pureeItems = [];
  renderPureeList();
});

renderPureeList();

/* ---------- Helpers ---------- */
const formatPureeCell = solidsArr =>
  Array.isArray(solidsArr) && solidsArr.length
    ? solidsArr.map(s => `${s.name} ${Number(s.grams)||0}г`).join(' + ')
    : '—';

const pureeTotalGrams = solidsArr =>
  (Array.isArray(solidsArr) ? solidsArr.reduce((a, s) => a + (Number(s.grams)||0), 0) : 0);

/* ---------- Feeding ---------- */
const render = e => `
<tr>
  ${cell(e.date,'Дата')}${cell(e.time,'Час')}
  ${cell(e.formula||0,'Адаптирано')}${cell(e.breastmilk||0,'Кърма')}
  ${cell(isTrue(e.poo)?'✅':'❌','Акал')}${cell(isTrue(e.pee)?'✅':'❌','Пишал')}
  ${cell(isTrue(e.breastfeeding)?`✅${e.breastfeedingTime?` (${e.breastfeedingTime}м)`:''}`:'❌','Кърмене')}
  ${cell(isTrue(e.vitaminD)?'ДА':'—','Витамин D')}
  ${cell(formatPureeCell(e.solids),'Пюре')}
  ${cell(e.notes||'','Забележки')}
  ${buttons(e.id,false)}
</tr>`;

const clear = () => {
  els.table.innerHTML = '';
  els.summary.innerHTML = '';
};

const updateUI = list => {
  clear();
  const sorted = [...list].sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  els.table.innerHTML = sorted.map(render).join('');

  const feedsCount = sorted.length;
const feedsCount = sorted.filter(e => {
  const formula     = Number(e.formula)     || 0;
  const breastmilk  = Number(e.breastmilk)  || 0;
  const hasMilk     = formula > 0 || breastmilk > 0;

  const hasSolids   = Array.isArray(e.solids) &&
    e.solids.some(s => s && (Number(s.grams) || 0) > 0);

  const hasBreastfeeding =
    isTrue(e.breastfeeding) ||
    (e.breastfeedingTime != null &&
     e.breastfeedingTime !== '' &&
     Number(e.breastfeedingTime) > 0);

  return hasMilk || hasSolids || hasBreastfeeding;
}).length;

  const sums = sorted.reduce((acc, e) => {
    acc.formula     += Number(e.formula)     || 0;
    acc.breastmilk  += Number(e.breastmilk)  || 0;
    return acc;
  }, { formula: 0, breastmilk: 0 });

  const counts = ['poo','pee','breastfeeding'].reduce((acc, key) => {
    acc[key] = sorted.filter(e => isTrue(e[key])).length;
    return acc;
  }, {});

  const solidsByItem = {};
  let solidsTotal = 0;

  sorted.forEach(e => {
    (e.solids || []).forEach(s => {
      const name = (s && s.name) || '';
      if (!name) return;
      const g = Number(s.grams) || 0;
      solidsTotal += g;
      // дневна агрегация – пазим оригиналното име
      solidsByItem[name] = (solidsByItem[name] || 0) + g;
    });
  });

  // lifetime списък без дубликати (Броколи / броколи) + брой пъти
  const lifetimeList = (() => {
    const byNorm = {};

    Object.entries(lifetimeSolids).forEach(([name, count]) => {
      if (!name) return;
      const trimmed = name.trim();
      if (!trimmed) return;

      const norm = trimmed.toLocaleLowerCase('bg-BG');
      const c = Number(count) || 0;

      if (!byNorm[norm]) {
        byNorm[norm] = { name: trimmed, count: c };
      } else {
        byNorm[norm].count += c;
      }
    });

    return Object.values(byNorm).sort((a, b) =>
      a.name.localeCompare(b.name, 'bg-BG')
    );
  })();

  const lifetimeHtml = lifetimeList.length
    ? `<ul class="summary-foods">
         ${lifetimeList
           .map(item => `<li><em>${item.name}</em>${item.count ? ` (${item.count})` : ''}</li>`)
           .join('')}
       </ul>`
    : '<p class="is-muted">Няма въведени храни.</p>';

  const solidsTable = Object.keys(solidsByItem).length
    ? `<table class="mini"><thead><tr><th>Съставка</th><th>Общо (г)</th></tr></thead><tbody>
         ${Object.entries(solidsByItem).map(([k,v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
       </tbody></table>`
    : '<p class="is-muted">Няма пюрета за тази дата.</p>';

  const totalMilk = sums.formula + sums.breastmilk;
  const totalAll  = totalMilk + solidsTotal;

  // Витамин D за деня
  const vitaminGiven = sorted.some(e => isTrue(e.vitaminD));

  if (vitaminLabel) {
    if (vitaminGiven) {
      vitaminLabel.style.display = 'none';
    } else {
      vitaminLabel.style.display = '';
      if (vitaminCheckbox) {
        vitaminCheckbox.checked = false;
      }
    }
  }

  els.summary.innerHTML = `
    <p>Брой хранения: <strong>${feedsCount}</strong></p>
    <p>Адаптирано мл: <strong>${sums.formula} мл</strong></p>
    <p>Кърма мл: <strong>${sums.breastmilk} мл</strong></p>
    <p>Общо мляко за деня: <strong>${totalMilk} мл</strong></p>
    <p>Акал: <strong>${counts.poo}</strong></p>
    <p>Пишал: <strong>${counts.pee}</strong></p>
    <p>Кърмене: <strong>${counts.breastfeeding}</strong></p>
    <p>Витамин D: <strong>${vitaminGiven ? 'ДА' : 'НЕ'}</strong></p>
    
    <p>Пюре общо за деня: <strong>${solidsTotal} г</strong></p>
    <p class="all-food">Общо количество храна (мляко + пюре): <strong>${totalAll}</strong></p>
    ${solidsTable}
    
    <div class="summary__foods">
      <p>Храни до момента (пюрета, общо):</p>
      ${lifetimeHtml}
    </div>
  `;
};


window.del = async (id) => {
  await deleteEntry(uid, id);
  if (uid) {
    rebuildLifetimeSolidsFromHistory(uid);
  }
};

window.toggleEdit = async id => {
  const btn = event.target;
  const row = btn.closest('tr');

  if (btn.textContent === '✏️') {
    const data = await getEntry(uid, id);
    const solids = Array.isArray(data.solids) ? data.solids : [];

    row.innerHTML = `
      <td><input name="date" type="date" value="${data.date || today()}"/></td>
      <td><input name="time" type="time" value="${data.time || ''}"/></td>
      <td><input name="formula" type="number" value="${data.formula||0}"/></td>
      <td><input name="breastmilk" type="number" value="${data.breastmilk||0}"/></td>
      <td><input name="poo" type="checkbox" ${isTrue(data.poo)?'checked':''}/></td>
      <td><input name="pee" type="checkbox" ${isTrue(data.pee)?'checked':''}/></td>
      <td>
        <input name="breastfeeding" type="checkbox" ${isTrue(data.breastfeeding)?'checked':''}/>
        <input name="breastfeedingTime" type="number" value="${data.breastfeedingTime||''}" placeholder="мин"/>
      </td>
      <td><input name="vitaminD" type="checkbox" ${isTrue(data.vitaminD)?'checked':''}/></td>
      <td>
        ${(solids||[]).map(s=>`
          <div class="solid-row js-solid-row">
            <input name="solid_name" value="${s.name}" list="ingredients"/>
            <input name="solid_grams" type="number" value="${s.grams}"/>
            <button type="button" class="solid-row__remove" onclick="removeSolidRow(this)">✖</button>
          </div>`).join('')}
        <button type="button" class="btn--mini" onclick="addSolidRow(this)">+ съставка</button>
        <datalist id="ingredients">
          ${INGREDIENTS.map(x => `<option value="${x}">`).join('')}
        </datalist>
      </td>
      <td><textarea name="notes">${data.notes||''}</textarea></td>
      <td class="table__cell"><button class="table__edit" onclick="toggleEdit('${id}')">💾</button>
          <button class="table__delete" onclick="del('${id}')">🗑️</button></td>
    `;
  } else {
    const updated = {
      date: (row.querySelector('input[name="date"]')?.value || ''),
      time: (row.querySelector('input[name="time"]')?.value || ''),
      formula: parseInt(row.querySelector('input[name="formula"]')?.value,10)||0,
      breastmilk: parseInt(row.querySelector('input[name="breastmilk"]')?.value,10)||0,
      poo: !!row.querySelector('input[name="poo"]')?.checked,
      pee: !!row.querySelector('input[name="pee"]')?.checked,
      breastfeeding: !!row.querySelector('input[name="breastfeeding"]')?.checked,
      breastfeedingTime: (() => {
        const v = row.querySelector('input[name="breastfeedingTime"]')?.value;
        return v === '' || v == null ? null : (parseInt(v, 10) || 0);
      })(),
      vitaminD: !!row.querySelector('input[name="vitaminD"]')?.checked,
      notes: (row.querySelector('textarea[name="notes"]')?.value || '')
    };

    const solids = Array.from(row.querySelectorAll('.js-solid-row')).map(r => {
      const name = r.querySelector('input[name="solid_name"]')?.value?.trim() || '';
      const grams = parseInt(r.querySelector('input[name="solid_grams"]')?.value,10)||0;
      return name && grams>0 ? { name, grams } : null;
    }).filter(Boolean);

    updated.solids = solids;
    updated.solidsTotal = solids.reduce((a, s) => a + (Number(s.grams)||0), 0);

    await updateEntry(uid, id, updated);
    if (uid) {
      rebuildLifetimeSolidsFromHistory(uid);
    }
  }
};

window.addSolidRow = (btn) => {
  const container = btn.closest('td');
  container.insertAdjacentHTML('afterbegin', `
    <div class="solid-row js-solid-row">
      <input name="solid_name" list="ingredients" placeholder="съставка"/>
      <input name="solid_grams" type="number" placeholder="г"/>
      <button type="button" class="solid-row__remove" onclick="removeSolidRow(this)">✖</button>
    </div>
  `);
};

window.removeSolidRow = (btn) => {
  btn.closest('.js-solid-row')?.remove();
};

/* ---------- Sleep ---------- */
const toMinutes = t => { if (!t) return 0; const [h,m]=t.split(':').map(Number); return h*60+m; };
const fmtHM = mins => `${Math.floor(mins/60)}ч ${mins%60}м`;
const minutesDiff = (s,e)=>toMinutes(e)-toMinutes(s);

const renderSleep = e => {
  const mins = minutesDiff(e.start, e.end);
  return `<tr>
    ${cell(e.date,'Дата')}${cell(e.start,'Начало')}${cell(e.end,'Край')}
    ${cell(mins>0?fmtHM(mins):'—','Продължителност')}
    ${cell(e.notes||'','Забележки')}
    <td class="table__cell">
      <button class="table__edit" onclick="toggleSleepEdit('${e.id}')">✏️</button>
      <button class="table__delete" onclick="delSleep('${e.id}')">🗑️</button>
    </td>
  </tr>`;
};

const clearSleep = () => {
  els.sleepTable.innerHTML = '';
  els.sleepSummary.innerHTML = '';
};

const updateSleepUI = list => {
  clearSleep();
  const sorted = [...list].sort((a,b) => (b.start||'').localeCompare(a.start||''));
  els.sleepTable.innerHTML = sorted.map(renderSleep).join('');
  const total = sorted.reduce((a,e)=>a+Math.max(0,minutesDiff(e.start,e.end)),0);
  els.sleepSummary.innerHTML = `<p>Общо сън: <strong>${fmtHM(total)}</strong></p>`;
};

window.delSleep = id => deleteSleep(uid,id);

window.toggleSleepEdit = async id => {
  const btn = event.target;
  const row = btn.closest('tr');
  if (btn.textContent==='✏️'){
    const e=await getSleepEntry(uid,id);
    row.innerHTML=`
      <td><input name="date" type="date" value="${e.date||today()}"/></td>
      <td><input name="start" type="time" value="${e.start||''}"/></td>
      <td><input name="end" type="time" value="${e.end||''}"/></td>
      <td>${(() => { const d=minutesDiff(e.start,e.end); return d>0?fmtHM(d):'—'; })()}</td>
      <td><textarea name="notes">${e.notes||''}</textarea></td>
      <td class="table__cell"><button class="table__edit" onclick="toggleSleepEdit('${id}')">💾</button>
          <button class="table__delete" onclick="delSleep('${id}')">🗑️</button></td>`;
  } else {
    const vals=Object.fromEntries([...row.querySelectorAll('input,textarea')].map(el=>[el.name,el.value]));
    await updateSleep(uid,id,vals);
  }
};

/* ---------- Pump ---------- */
const renderPump = e => `
<tr>
  ${cell(e.date,'Дата')}${cell(e.time,'Час')}
  ${cell(e.amount||0,'Количество (мл)')}${cell(e.notes||'','Забележки')}
  <td class="table__cell">
    <button class="table__edit" onclick="togglePumpEdit('${e.id}')">✏️</button>
    <button class="table__delete" onclick="delPump('${e.id}')">🗑️</button>
  </td>
</tr>`;

const clearPump = () => {
  els.pumpTable.innerHTML = '';
  els.pumpSummary.innerHTML = '';
};

const updatePumpUI = list => {
  clearPump();
  const sorted = [...list].sort((a,b)=>(b.time||'').localeCompare(a.time||''));
  els.pumpTable.innerHTML = sorted.map(renderPump).join('');
  const total = sorted.reduce((a,e)=>a+(Number(e.amount)||0),0);
  els.pumpSummary.innerHTML = `<p>Общо: <strong>${total} мл</strong></p>`;
};

window.delPump=id=>deletePump(uid,id);

window.togglePumpEdit=async id=>{
  const btn=event.target;
  const row=btn.closest('tr');
  if(btn.textContent==='✏️'){
    const e=await getPumpEntry(uid,id);
    row.innerHTML=`
      <td><input name="date" type="date" value="${e.date||today()}"/></td>
      <td><input name="time" type="time" value="${e.time||''}"/></td>
      <td><input name="amount" type="number" min="0" step="1" value="${Number(e.amount)||0}"/></td>
      <td><textarea name="notes">${e.notes||''}</textarea></td>
      <td class="table__cell"><button class="table__edit" onclick="togglePumpEdit('${id}')">💾</button>
          <button class="table__delete" onclick="delPump('${id}')">🗑️</button></td>`;
  } else {
    const updated = {
      date:  row.querySelector('input[name="date"]').value,
      time:  row.querySelector('input[name="time"]').value,
      amount: parseInt(row.querySelector('input[name="amount"]').value,10)||0,
      notes: row.querySelector('textarea[name="notes"]').value
    };
    await updatePump(uid,id,updated);
  }
};

/* ---------- Auth & Submit flows ---------- */
els.login?.addEventListener('click', async () => {
  const email    = $('#email').value;
  const pwd      = $('#password').value;
  const remember = $('#rememberMe').checked;
  try { await login(email, pwd, remember); }
  catch(err) { alert(err.message); }
});
els.logout?.addEventListener('click', () => logout());

// toggle на поле време за кърмене
const bfCheckbox = $('#breastfeeding');
const bfTimeBox  = $('#breastfeedingTimeContainer');
bfCheckbox?.addEventListener('change', () => {
  bfTimeBox.style.display = bfCheckbox.checked ? 'block' : 'none';
});

els.form?.addEventListener('submit', async e => {
  e.preventDefault();
  const data = new FormData(els.form);

  let solids = [];
  try { solids = JSON.parse(data.get('solidsJson') || '[]'); } catch(e){ solids = []; }

  const entry = {
    date:           els.date.value || today(),
    time:           data.get('time'),
    formula:        parseInt(data.get('formula'), 10)    || 0,
    breastmilk:     parseInt(data.get('breastmilk'), 10) || 0,
    poo:            data.get('poo')           === 'on',
    pee:            data.get('pee')           === 'on',
    vitaminD:       data.get('vitaminD')      === 'on',
    breastfeeding:  data.get('breastfeeding') === 'on',
    breastfeedingTime: (() => {
      const v = data.get('breastfeedingTime');
      return v === '' || v == null ? null : (parseInt(v, 10) || 0);
    })(),
    notes:          data.get('notes')         || '',
    ...(solids.length ? { solids, solidsTotal: pureeTotalGrams(solids) } : { solids: [], solidsTotal: 0 })
  };

  await addEntry(uid, entry);
  if (uid) {
    rebuildLifetimeSolidsFromHistory(uid);
  }
  els.form.reset();
  pureeItems = [];
  renderPureeList();
  if (bfTimeBox) {
    bfTimeBox.style.display = 'none';
  }
});

/* ---------- Sleep submit ---------- */
els.sleepForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const data = new FormData(els.sleepForm);
  const entry = {
    date:  els.date.value || today(),
    start: data.get('start'),
    end:   data.get('end'),
    notes: data.get('notes') || ''
  };
  const toMin = t => { if(!t) return 0; const [h,m]=t.split(':').map(Number); return h*60+m; };
  if (toMin(entry.end) <= toMin(entry.start)) { alert('Краят трябва да е след началото (същия ден).'); return; }
  await addSleep(uid, entry);
  els.sleepForm.reset();
});

/* ---------- Pump submit ---------- */
els.pumpForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const data = new FormData(els.pumpForm);
  const entry = {
    date:   els.date.value || today(),
    time:   data.get('time'),
    amount: parseInt(data.get('amount'), 10) || 0,
    notes:  data.get('notes') || ''
    };
  await addPump(uid, entry);
  els.pumpForm.reset();
});

/* ---------- Listen per date ---------- */
const subscribeForCurrentDate = () => {
  if (!uid || !els.date) return;
  unsubscribe && unsubscribe();
  sleepUnsub  && sleepUnsub();
  pumpUnsub   && pumpUnsub();

  const d = els.date.value || today();
  unsubscribe = listenEntries(uid, d, updateUI);
  sleepUnsub  = listenSleep(uid,   d, updateSleepUI);
  pumpUnsub   = listenPump(uid,    d, updatePumpUI);
};

els.date?.addEventListener('change', subscribeForCurrentDate);

/* ---------- Auth guard ---------- */
onAuthStateChanged(auth, user => {
  if (user) {
    uid = user.uid;
    els.auth.hidden = true;
    els.app.hidden  = false;
    els.date.value  = today();

    rebuildLifetimeSolidsFromHistory(uid)
      .finally(() => {
        subscribeForCurrentDate();
      });

  } else {
    uid = null;
    els.app.hidden  = true;
    els.auth.hidden = false;

    els.table.innerHTML = '';
    els.summary.innerHTML = '';
    els.sleepTable.innerHTML = '';
    els.sleepSummary.innerHTML = '';
    els.pumpTable.innerHTML = '';
    els.pumpSummary.innerHTML = '';

    unsubscribe = null;
    sleepUnsub  = null;
    pumpUnsub   = null;
  }
});
