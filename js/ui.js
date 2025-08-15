import { addEntry, deleteEntry, updateEntry, listenEntries, getEntry } from './db.js';
import { addSleep, deleteSleep, updateSleep, listenSleep, getSleepEntry } from './db.js';
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

/* ============ Feeding render ============ */
const render = e => `
<tr>
  ${cell(e.date,'Дата')}${cell(e.time,'Час')}
  ${cell(e.formula||0,'Адаптирано')}${cell(e.breastmilk||0,'Кърма')}
  ${cell(isTrue(e.poo)?'✅':'❌','Акал')}${cell(isTrue(e.pee)?'✅':'❌','Пишал')}
  ${cell(isTrue(e.breastfeeding)?'✅':'❌','Кърмене')}${cell(e.notes||'','Забележки')}
  ${buttons(e.id,false)}
</tr>`;

const clear = () => {
  els.table.innerHTML = '';
  els.summary.innerHTML = '';
};

const updateUI = list => {
  clear();
  const sorted = [...list].sort((a, b) => b.time?.localeCompare(a.time || '') || 0);
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
      Number(e.formula) > 0 || Number(e.breastmilk) > 0 || isTrue(e.breastfeeding)
    ).length
  };

  els.summary.innerHTML = `
    <p>Общо хранения: <strong class="is-red">${feedCounts.totalMeals}</strong></p>
    <p>Ядения с адаптирано мляко: <strong>${feedCounts.formulaMeals}</strong></p>
    <p>Адаптирано мл: <strong>${sums.formula} мл</strong></p>
    <p>Кърма мл: <strong>${sums.breastmilk} мл</strong></p>
    <p>Акал: <strong>${counts.poo}</strong></p>
    <p>Пишал: <strong>${counts.pee}</strong></p>
    <p>Кърмене: <strong>${counts.breastfeeding}</strong></p>
  `;
};

/* ============ Feeding globals ============ */
window.del = id => deleteEntry(uid, id);

window.toggleEdit = async id => {
  const btn = event.target;
  const row = btn.closest('tr');

  if (btn.textContent === '✏️') {
    const data = await getEntry(uid, id);
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
    const updated = {
      date:          elements[0].value,
      time:          elements[1].value,
      formula:       +elements[2].value     || 0,
      breastmilk:    +elements[3].value     || 0,
      poo:           elements[4].checked,
      pee:           elements[5].checked,
      breastfeeding: elements[6].checked,
      notes:         elements[7].value
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
  const sorted = [...list].sort((a, b) => (a.start || '').localeCompare(b.start || ''));
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
      notes: elements[4].value
    };
    const err = validateSleep(updated.date, updated.start, updated.end);
    if (err) {
      alert(err);
      return;
    }
    await updateSleep(uid, id, updated);
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

els.form.addEventListener('submit', async e => {
  e.preventDefault();
  const data = new FormData(els.form);
  const entry = {
    date:         els.date.value || today(),
    time:         data.get('time'),
    formula:      parseInt(data.get('formula'), 10)    || 0,
    breastmilk:   parseInt(data.get('breastmilk'), 10) || 0,
    poo:          data.get('poo')           === 'on',
    pee:          data.get('pee')           === 'on',
    breastfeeding:data.get('breastfeeding') === 'on',
    notes:        data.get('notes')         || ''
  };
  await addEntry(uid, entry);
  els.form.reset();
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

// При смяна на дата – презареждаме и двете секции
els.date.addEventListener('change', () => {
  if (!uid) return;
  unsubscribe && unsubscribe();
  sleepUnsub  && sleepUnsub();
  unsubscribe = listenEntries(uid, els.date.value, updateUI);
  sleepUnsub  = listenSleep(uid,   els.date.value, updateSleepUI);
});

onAuthStateChanged(auth, user => {
  if (user) {
    uid = user.uid;
    els.auth.hidden = true;
    els.app.hidden  = false;
    els.date.value  = today();

    unsubscribe && unsubscribe();
    sleepUnsub  && sleepUnsub();
    unsubscribe = listenEntries(uid, els.date.value, updateUI);
    sleepUnsub  = listenSleep(uid,   els.date.value, updateSleepUI);
  } else {
    uid = null;
    els.app.hidden  = true;
    els.auth.hidden = false;

    clear();
    clearSleep();

    unsubscribe = null;
    sleepUnsub  = null;
  }
});
