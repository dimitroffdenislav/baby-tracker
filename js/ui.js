// ui.js
import { addEntry, deleteEntry, updateEntry, listenEntries, getEntry } from './db.js';
import { login, logout } from './auth.js';
import { auth } from './firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const $ = selector => document.querySelector(selector);
const els = {
  auth: $('#authSection'),
  app: $('#appSection'),
  form: $('#entryForm'),
  table: $('#dataTable'),
  summary: $('#summary'),
  date: $('input[name=date]'),
  login: $('#loginBtn'),
  logout: $('#logoutBtn'),
};

const today = () => new Date().toISOString().split('T')[0];
const isTrue = v => [true, '✅', 'Да'].includes(v);
const cell = (val, label) => `<td data-label="${label}">${val}</td>`;
const buttons = (id, edit) => `
  <td class="table__cell">
    <button class="table__edit" onclick="toggleEdit('${id}')">${edit ? '💾' : '✏️'}</button>
    <button class="table__delete" onclick="del('${id}')">🗑️</button>
  </td>`;

const render = e => `
<tr>
  ${cell(e.date,'Дата')}${cell(e.time,'Час')}
  ${cell(e.formula||0,'Адаптирано')}${cell(e.breastmilk||0,'Кърма')}
  ${cell(isTrue(e.poo)?'✅':'❌','Акал')}${cell(isTrue(e.pee)?'✅':'❌','Пишал')}
  ${cell(isTrue(e.breastfeeding)?'✅':'❌','Кърмене')}${cell(e.notes||'','Забележки')}
  ${buttons(e.id,false)}
</tr>`;

let unsubscribe = null;
let uid = null;

const clear = () => {
  els.table.innerHTML = '';
  els.summary.innerHTML = '';
};

const updateUI = list => {
  clear();
  const sorted = [...list].sort((a, b) => b.time.localeCompare(a.time));
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
    breastmilkMeals: sorted.filter(e => Number(e.breastmilk) > 0).length
  };

  els.summary.innerHTML = `
    <p>Брой ядения: <strong class="is-red">${feedCounts.formulaMeals}</strong></p>
    <p>Адаптирано мл: <strong>${sums.formula} мл</strong></p>
    <p>Кърма мл: <strong>${sums.breastmilk} мл</strong></p>
    <p>Акал: <strong>${counts.poo}</strong></p>
    <p>Пишал: <strong>${counts.pee}</strong></p>
    <p>Кърмене: <strong>${counts.breastfeeding}</strong></p>
  `;
};

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
    row.innerHTML = inputs + buttons(id, true);
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
    date:         data.get('date'),
    time:         data.get('time'),
    formula:      parseInt(data.get('formula'), 10)    || 0,
    breastmilk:   parseInt(data.get('breastmilk'), 10) || 0,
    poo:          data.get('poo')          === 'on',
    pee:          data.get('pee')          === 'on',
    breastfeeding:data.get('breastfeeding') === 'on',
    notes:        data.get('notes')        || ''
  };
  await addEntry(uid, entry);
  els.form.reset();
  els.date.value = today();
});

els.date.addEventListener('change', () => {
  if (!uid) return;
  unsubscribe && unsubscribe();
  unsubscribe = listenEntries(uid, els.date.value, updateUI);
});

onAuthStateChanged(auth, user => {
  if (user) {
    uid = user.uid;
    els.auth.hidden = true;
    els.app.hidden  = false;
    els.date.value  = today();
    unsubscribe && unsubscribe();
    unsubscribe = listenEntries(uid, els.date.value, updateUI);
  } else {
    uid = null;
    clear();
    els.app.hidden  = true;
    els.auth.hidden = false;
  }
});
