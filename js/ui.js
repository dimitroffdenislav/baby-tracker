import {
  addEntry, deleteEntry, updateEntry, listenEntries, getEntry,
  addSleep, deleteSleep, updateSleep, listenSleep, getSleepEntry,
  addPump, deletePump, updatePump, listenPump, getPumpEntry
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

/* ---------- INGREDIENTS: чести зеленчуци/плодове/меса/риба ---------- */
const INGREDIENTS = [
  // Зеленчуци – кореноплоди, тиквени, листни, кръстоцветни, лукови
  'морков','тиква','картоф','сладък картоф','пащърнак','целина (корен)','целина (стъбла)',
  'ряпа','колраби','червено цвекло','топинамбур',
  'тиквичка','краставица','зелен боб','зелен грах','царевица','карфиол','броколи','брюкселско зеле',
  'бяло зеле','киселo зеле','коприва','спанак','манголд','лапад',
  'домaт','чушка (сладка)','патладжан','праз','лук','чесън','гъби (култивирани, печурка)',
  // Плодове – семкови, костилкови, ягодоплодни, тропични, други местни
  'ябълка','круша','дюля','райска ябълка',
  'банан','киви','смокиня','грозде (бяло)','грозде (червено)','диня','пъпеш',
  'праскова','кайсия','слива','череша','вишна','мирула/мушмула',
  'ягода','боровинка','малина','къпина','касис','цариградско грозде',
  // Зърнени/каши и псевдозърна
  'ориз','оризова каша','овесени ядки','овесена каша','ечемик','пшеница (грис)','булгур','кус-кус',
  'просо','елда','киноа','амарант','царевично брашно/полента',
  // Бобови
  'червена леща','кафява леща','нахут','бял боб','бакла',
  // Млечни/яйчни (според възраст и толеранс)
  'кисело мляко','кефир','извара','рикота','сирене (обезсолено)','маскарпоне',
  'яйчен жълтък','цяло яйце (разбито, термично обработено)',
  // Ядкови пасти/семена (гладки пасти за алергенно въвеждане)
  'тахан (сусамов)','фъстъчено масло (гладко)','бадемово масло (гладко)',
  'ленено семе (смляно)','чия (накисната)',
  // Мазнини за обогатяване
  'зехтин','масло','гхи','студенопресовано слънчогледово олио','рапично олио',
  // Меса – местни и често ползвани
  'пилешко','пуешко','заешко','телешко','агнешко','свинско (постно)',
  'черен дроб (пилешки/телешки)',
  // Риба и морски
  'сьомга','пъстърва','бяла риба','хек','треска','скумрия','сардина','тон','карагьоз','шаран',
  // Други добавки/вкусове (по малко)
  'копър','магданоз','мащерка','риган','ванилия (натурална)',
  // Напитки/добавки към пюрета
  'костен бульон (безсолен)','ябълков пектин','плодово пюре (без захар)'
];


// Състояние за текущото пюре преди submit
let pureeItems = []; // [{ name:'морков', grams:40 }, ...]

// Helpers за пюре
const formatPureeCell = solidsArr => {
  if (!Array.isArray(solidsArr) || !solidsArr.length) return '—';
  return solidsArr.map(s => `${s.name} ${Number(s.grams)||0}г`).join(' + ');
};
const pureeTotalGrams = solidsArr =>
  (Array.isArray(solidsArr) ? solidsArr.reduce((a, s) => a + (Number(s.grams)||0), 0) : 0);

/* ============ Elements ============ */
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
  tabs:    document.querySelectorAll('.tab'),
};

let unsubscribe = null;  // feeding
let sleepUnsub  = null;  // sleep
let pumpUnsub   = null;  // pumps
let uid = null;

/* ============ Tabs ============ */
els.tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    els.tabBtns.forEach(b => b.classList.remove('is-active'));
    els.tabs.forEach(t => t.classList.remove('is-active'));
    btn.classList.add('is-active');
    document.getElementById(btn.dataset.tab).classList.add('is-active');
  });
});

/* --------- Puree UI (инжектира се в края на #entryForm) --------- */
function createPureeUI() {
  if (!els.form) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'puree';
  wrapper.innerHTML = `
    <div class="puree__row">
      <label>Пюре – съставка</label>
      <input id="pureeName" list="ingredients" placeholder="напр. морков" />
      <datalist id="ingredients">
        ${INGREDIENTS.map(x => `<option value="${x}">`).join('')}
      </datalist>
      <label>Количество (г)</label>
      <input id="pureeQty" type="number" min="0" step="5" placeholder="грамове" />
      <button type="button" id="addPuree">Добави</button>
    </div>
    <ul id="pureeList" class="puree__list"></ul>
    <input type="hidden" name="solidsJson" id="solidsJson" />
  `;
  els.form.appendChild(wrapper);

  const $name = wrapper.querySelector('#pureeName');
  const $qty  = wrapper.querySelector('#pureeQty');
  const $list = wrapper.querySelector('#pureeList');
  const $hid  = wrapper.querySelector('#solidsJson');

  const rerender = () => {
    $list.innerHTML = pureeItems.length
      ? pureeItems.map((it, i) =>
          `<li>
             <span>${it.name} — <strong>${it.grams}г</strong></span>
             <button type="button" data-i="${i}" class="puree__remove">✖</button>
           </li>`).join('')
      : '<li class="is-muted">Няма добавени съставки</li>';
    $hid.value = JSON.stringify(pureeItems);
  };

  wrapper.addEventListener('click', e => {
    const btn = e.target.closest('.puree__remove');
    if (!btn) return;
    const i = Number(btn.dataset.i);
    if (!Number.isNaN(i)) {
      pureeItems.splice(i, 1);
      rerender();
    }
  });

  wrapper.querySelector('#addPuree').addEventListener('click', () => {
    const name = ($name.value || '').trim();
    const grams = parseInt($qty.value, 10) || 0;
    if (!name || grams <= 0) return;
    pureeItems.push({ name, grams });
    $name.value = '';
    $qty.value = '';
    rerender();
  });

  els.form.addEventListener('reset', () => {
    pureeItems = [];
    rerender();
  });

  rerender();
}
createPureeUI();

/* ============ Feeding render ============ */
const render = e => `
<tr>
  ${cell(e.date,'Дата')}${cell(e.time,'Час')}
  ${cell(e.formula||0,'Адаптирано')}${cell(e.breastmilk||0,'Кърма')}
  ${cell(isTrue(e.poo)?'✅':'❌','Акал')}${cell(isTrue(e.pee)?'✅':'❌','Пишал')}
  ${cell(isTrue(e.breastfeeding)?`✅${e.breastfeedingTime?` (${e.breastfeedingTime}м)`:''}`:'❌','Кърмене')}
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

  const sums = sorted.reduce((acc, e) => {
    acc.formula     += Number(e.formula)     || 0;
    acc.breastmilk  += Number(e.breastmilk)  || 0;
    return acc;
  }, { formula: 0, breastmilk: 0 });

  const counts = ['poo','pee','breastfeeding'].reduce((acc, key) => {
    acc[key] = sorted.filter(e => isTrue(e[key])).length;
    return acc;
  }, {});

  const feedCounts = {
    formulaMeals: sorted.filter(e => Number(e.formula) > 0).length,
    breastmilkMeals: sorted.filter(e => Number(e.breastmilk) > 0).length,
    breastfeedingEvents: sorted.filter(e => isTrue(e.breastfeeding)).length,
    totalMeals: sorted.filter(e =>
      Number(e.formula) > 0 || Number(e.breastmilk) > 0 || isTrue(e.breastfeeding) || (e.solids && e.solids.length)
    ).length
  };

  // Пюрета: тотал и разбивка
  let solidsTotal = 0;
  const solidsByItem = {};
  sorted.forEach(e => {
    (e.solids || []).forEach(s => {
      const g = Number(s.grams) || 0;
      solidsTotal += g;
      solidsByItem[s.name] = (solidsByItem[s.name] || 0) + g;
    });
  });
  const solidsTable = Object.keys(solidsByItem).length
    ? `<table class="mini">
         <thead><tr><th>Съставка</th><th>Общо (г)</th></tr></thead>
         <tbody>
           ${Object.entries(solidsByItem).map(([k,v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
         </tbody>
       </table>`
    : '<p class="is-muted">Няма пюрета за тази дата.</p>';

  els.summary.innerHTML = `
    <p>Общо хранения: <strong class="is-red">${feedCounts.totalMeals}</strong></p>
    <p>Ядения с адаптирано мляко: <strong>${feedCounts.formulaMeals}</strong></p>
    <p>Адаптирано мл: <strong>${sums.formula} мл</strong></p>
    <p>Кърма мл: <strong>${sums.breastmilk} мл</strong></p>
    <p>Акал: <strong>${counts.poo}</strong></p>
    <p>Пишал: <strong>${counts.pee}</strong></p>
    <p>Кърмене: <strong>${counts.breastfeeding}</strong></p>
    <hr/>
    <p>Пюре общо за деня: <strong>${solidsTotal} г</strong></p>
    ${solidsTable}
  `;
};

/* ============ Feeding globals ============ */
window.del = id => deleteEntry(uid, id);

window.toggleEdit = async id => {
  const btn = event.target;
  const row = btn.closest('tr');

  if (btn.textContent === '✏️') {
    const data = await getEntry(uid, id);

    // запази solids в dataset, за да не ги губим при save
    row.dataset.solids = JSON.stringify(data.solids || []);
    row.dataset.solidsTotal = String(data.solidsTotal || pureeTotalGrams(data.solids||[]));

    const inputs = ['date','time','formula','breastmilk']
      .map(f => `<td><input name="${f}" value="${data[f] || ''}"/></td>`).join('') +
      ['poo','pee','breastfeeding']
      .map(b => `<td><input type="checkbox" name="${b}" ${isTrue(data[b]) ? 'checked' : ''}/></td>`).join('') +
      `<td><textarea name="notes">${data.notes || ''}</textarea></td>`;
    row.innerHTML = inputs + `
      <td class="table__cell">
        <button class="table__edit" onclick="toggleEdit('${id}')">💾</button>
        <button class="table__delete" onclick="del('${id}')">🗑️</button>
      </td>`;
  } else {
    const elements = Array.from(row.querySelectorAll('input,textarea'));

    // възстанови solids
    let keepSolids = [];
    try { keepSolids = JSON.parse(row.dataset.solids || '[]'); } catch(e){ keepSolids = []; }
    const keepSolidsTotal = keepSolids.length ? (Number(row.dataset.solidsTotal)||pureeTotalGrams(keepSolids)) : 0;

    const updated = {
      date:          elements[0].value,
      time:          elements[1].value,
      formula:       +elements[2].value     || 0,
      breastmilk:    +elements[3].value     || 0,
      poo:           elements[4].checked,
      pee:           elements[5].checked,
      breastfeeding: elements[6].checked,
      notes:         elements[7].value,
      ...(keepSolids.length ? { solids: keepSolids, solidsTotal: keepSolidsTotal } : {})
    };
    await updateEntry(uid, id, updated);
  }
};

/* ============ Sleep helpers/render ============ */
const toMinutes = t => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const minutesDiff = (start, end) => {
  const s = toMinutes(start), e = toMinutes(end);
  return e > s ? (e - s) : 0; // без преминаване през полунощ
};
const fmtHM = mins => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}ч ${m}м`;
};
const validateSleep = (date, start, end) => {
  if (!date) return 'Моля, избери дата.';
  if (!start || !end) return 'Моля, попълни начало и край.';
  const s = toMinutes(start), e = toMinutes(end);
  if (e <= s) return 'Краят трябва да е след началото (в рамките на същия ден).';
  return null;
};

const sleepCell = (val, label) => `<td data-label="${label}">${val}</td>`;
const sleepButtons = (id, edit) => `
  <td class="table__cell">
    <button class="table__edit" onclick="toggleSleepEdit('${id}')">${edit ? '💾' : '✏️'}</button>
    <button class="table__delete" onclick="delSleep('${id}')">🗑️</button>
  </td>`;
const renderSleep = e => {
  const mins = minutesDiff(e.start, e.end);
  const dur = mins > 0 ? fmtHM(mins) : '—';
  return `<tr>
    ${sleepCell(e.date, 'Дата')}${sleepCell(e.start, 'Начало')}
    ${sleepCell(e.end, 'Край')}${sleepCell(dur, 'Продължителност')}
    ${sleepCell(e.notes || '', 'Забележки')}
    ${sleepButtons(e.id, false)}
  </tr>`;
};

const clearSleep = () => {
  els.sleepTable.innerHTML = '';
  els.sleepSummary.innerHTML = '';
};

const updateSleepUI = list => {
  clearSleep();
  const sorted = [...list].sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  els.sleepTable.innerHTML = sorted.map(renderSleep).join('');
  const total = sorted.reduce((acc, e) => acc + minutesDiff(e.start, e.end), 0);
  els.sleepSummary.innerHTML = `
    <p>Брой сън сесии: <strong>${sorted.length}</strong></p>
    <p>Общо сън за деня: <strong class="is-green">${fmtHM(total)}</strong></p>
  `;
};
/* ============ Sleep globals ============ */
window.delSleep = id => deleteSleep(uid, id);

window.toggleSleepEdit = async id => {
  const btn = event.target;
  const row = btn.closest('tr');

  if (btn.textContent === '✏️') {
    const data = await getSleepEntry(uid, id);
    const inputs = [
      `<td><input name="date" type="date" value="${data.date || (els.date.value || '')}"/></td>`,
      `<td><input name="start" type="time" value="${data.start || ''}"/></td>`,
      `<td><input name="end" type="time" value="${data.end || ''}"/></td>`,
      `<td>${minutesDiff(data.start, data.end) > 0 ? fmtHM(minutesDiff(data.start, data.end)) : '—'}</td>`,
      `<td><textarea name="notes">${data.notes || ''}</textarea></td>`
    ].join('');
    row.innerHTML = inputs + `
      <td class="table__cell">
        <button class="table__edit" onclick="toggleSleepEdit('${id}')">💾</button>
        <button class="table__delete" onclick="delSleep('${id}')">🗑️</button>
      </td>`;
  } else {
    const elements = Array.from(row.querySelectorAll('input,textarea'));
    const updated = {
      date:  elements[0].value,
      start: elements[1].value,
      end:   elements[2].value,
      notes: elements[3].value
    };
    const err = validateSleep(updated.date, updated.start, updated.end);
    if (err) {
      alert(err);
      return;
    }
    await updateSleep(uid, id, updated);
  }
};


/* ============ Pump helpers/render (Изцеждане) ============ */
const pumpCell = (val, label) => `<td data-label="${label}">${val}</td>`;
const pumpButtons = (id, edit) => `
  <td class="table__cell">
    <button class="table__edit" onclick="togglePumpEdit('${id}')">${edit ? '💾' : '✏️'}</button>
    <button class="table__delete" onclick="delPump('${id}')">🗑️</button>
  </td>`;
const renderPump = e => `
<tr>
  ${pumpCell(e.date,'Дата')}${pumpCell(e.time,'Час')}
  ${pumpCell(Number(e.amount) || 0,'Количество (мл)')}
  ${pumpCell(e.notes || '','Забележки')}
  ${pumpButtons(e.id,false)}
</tr>`;

const clearPump = () => {
  els.pumpTable.innerHTML = '';
  els.pumpSummary.innerHTML = '';
};

const updatePumpUI = list => {
  clearPump();
  const sorted = [...list].sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  els.pumpTable.innerHTML = sorted.map(renderPump).join('');

  const totalAmount = sorted.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const sessions = sorted.filter(e => Number(e.amount) > 0).length;

  els.pumpSummary.innerHTML = `
    <p>Брой изцеждания: <strong>${sessions}</strong></p>
    <p>Общо количество: <strong class="is-blue">${totalAmount} мл</strong></p>
  `;
};
/* ============ Pump globals ============ */
window.delPump = id => deletePump(uid, id);

window.togglePumpEdit = async id => {
  const btn = event.target;
  const row = btn.closest('tr');

  if (btn.textContent === '✏️') {
    const data = await getPumpEntry(uid, id);
    const inputs = [
      `<td><input name="date" type="date" value="${data.date || (els.date.value || '')}"/></td>`,
      `<td><input name="time" type="time" value="${data.time || ''}"/></td>`,
      `<td><input name="amount" type="number" min="0" step="1" value="${Number(data.amount)||0}"/></td>`,
      `<td><textarea name="notes">${data.notes || ''}</textarea></td>`
    ].join('');
    row.innerHTML = inputs + `
      <td class="table__cell">
        <button class="table__edit" onclick="togglePumpEdit('${id}')">💾</button>
        <button class="table__delete" onclick="delPump('${id}')">🗑️</button>
      </td>`;
  } else {
    const elements = Array.from(row.querySelectorAll('input,textarea'));
    const updated = {
      date:   elements[0].value,
      time:   elements[1].value,
      amount: parseInt(elements[2].value, 10) || 0,
      notes:  elements[3].value || ''
    };
    await updatePump(uid, id, updated);
  }
};

/* ============ Auth / events ============ */
els.login.addEventListener('click', async () => {
  const email    = $('#email').value;
  const pwd      = $('#password').value;
  const remember = $('#rememberMe').checked;
  try {
    await login(email, pwd, remember);
  } catch(err) {
    alert(err.message);
  }
});

els.logout.addEventListener('click', () => logout());

// Показване на поле "време на кърмене" само ако е чекнато
const bfCheckbox = $('#breastfeeding');
const bfTimeBox  = $('#breastfeedingTimeContainer');
bfCheckbox?.addEventListener('change', () => {
  bfTimeBox.style.display = bfCheckbox.checked ? 'block' : 'none';
});

els.form.addEventListener('submit', async e => {
  e.preventDefault();
  const data = new FormData(els.form);

  // solids от hidden input
  let solids = [];
  try { solids = JSON.parse(data.get('solidsJson') || '[]'); } catch(e){ solids = []; }

  const entry = {
    date:           els.date.value || today(),
    time:           data.get('time'),
    formula:        parseInt(data.get('formula'), 10)    || 0,
    breastmilk:     parseInt(data.get('breastmilk'), 10) || 0,
    poo:            data.get('poo')           === 'on',
    pee:            data.get('pee')           === 'on',
    breastfeeding:  data.get('breastfeeding') === 'on',
    breastfeedingTime: parseInt(data.get('breastfeedingTime'), 10) || null,
    notes:          data.get('notes')         || '',
    ...(solids.length ? { solids, solidsTotal: pureeTotalGrams(solids) } : {})
  };

  await addEntry(uid, entry);
  els.form.reset();
  bfTimeBox.style.display = 'none';
});

els.sleepForm.addEventListener('submit', async e => {
  e.preventDefault();
  const data = new FormData(els.sleepForm);
  const entry = {
    date:  els.date.value || today(),
    start: data.get('start'),
    end:   data.get('end'),
    notes: data.get('notes') || ''
  };
  const err = validateSleep(entry.date, entry.start, entry.end);
  if (err) {
    alert(err);
    return;
  }
  await addSleep(uid, entry);
  els.sleepForm.reset();
});

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

// При смяна на дата – презареждаме и трите секции
els.date.addEventListener('change', () => {
  if (!uid) return;
  unsubscribe && unsubscribe();
  sleepUnsub  && sleepUnsub();
  pumpUnsub   && pumpUnsub();

  unsubscribe = listenEntries(uid, els.date.value, updateUI);
  sleepUnsub  = listenSleep(uid,   els.date.value, updateSleepUI);
  pumpUnsub   = listenPump(uid,    els.date.value, updatePumpUI);
});

onAuthStateChanged(auth, user => {
  if (user) {
    uid = user.uid;
    els.auth.hidden = true;
    els.app.hidden  = false;
    els.date.value  = today();

    unsubscribe && unsubscribe();
    sleepUnsub  && sleepUnsub();
    pumpUnsub   && pumpUnsub();

    unsubscribe = listenEntries(uid, els.date.value, updateUI);
    sleepUnsub  = listenSleep(uid,   els.date.value, updateSleepUI);
    pumpUnsub   = listenPump(uid,    els.date.value, updatePumpUI);
  } else {
    uid = null;
    els.app.hidden  = true;
    els.auth.hidden = false;

    // clear UI
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
