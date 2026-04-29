// ── CONFIG ──
const WA_NUMBER = '5491140289444';
const PAGE_SIZE = 25;

// ── STATE ──
let products = [];
let cart = [];
let currentPage = 1;
let filtered = [];

// ── DISCOUNT CURVE ──
const PUNTOS = [[0,0],[1999,0],[2000,2],[4000,4.22],[6500,7],[10000,8.11],[13000,9.05],[16000,10]];
function getDiscount(total) {
  if (total <= 0) return 0;
  if (total >= 16000) return 10;
  for (let i = 1; i < PUNTOS.length; i++) {
    const [x0,d0]=PUNTOS[i-1],[x1,d1]=PUNTOS[i];
    if (total >= x0 && total <= x1) return d0 + (total-x0)/(x1-x0)*(d1-d0);
  }
  return 0;
}

// ── PAYMENT METHOD ──
const PAY_METHODS = {
  'trans-ars':      { label:'Transferencia bancaria (ARS)', icon:'🏦', name:'Transferencia bancaria', detail:'Pago en pesos (ARS)',                        badge:'Sin deducción',              badgeCls:'badge-free', baseDeduction:0,    perDay:0,    usdBonus:false },
  'echeck-propio':  { label:'e-check propio',               icon:'📄', name:'e-check propio',         detail:'Echeq de cuenta propia',                      badge:'Ded. 0.70% base + 0.08%/día', badgeCls:'badge-cost', baseDeduction:0.70, perDay:0.08, usdBonus:false },
  'cheque-fisico':  { label:'Cheque propio físico',         icon:'📋', name:'Cheque propio físico',   detail:'Cheque físico de cuenta propia',               badge:'Ded. 1.40% base + 0.08%/día', badgeCls:'badge-cost', baseDeduction:1.40, perDay:0.08, usdBonus:false },
  'echeck-terceros':{ label:'e-check de terceros',          icon:'📄', name:'e-check de terceros',    detail:'Echeq endosado de terceros',                   badge:'Ded. 1.90% base + 0.08%/día', badgeCls:'badge-cost', baseDeduction:1.90, perDay:0.08, usdBonus:false },
  'usd-trans':      { label:'Transferencia / depósito USD', icon:'💵', name:'USD',                    detail:'Pago 100% en dólares',                         badge:'+1.00% descuento adicional',  badgeCls:'badge-usd',  baseDeduction:0,    perDay:0,    usdBonus:true  },
};

let isUsdMode = false;
let _pmId = 0;
let payMix = [
  { id: _pmId++, type: 'trans-ars', pct: 100, days: 0 }
];

function toggleUsdMode(on) {
  isUsdMode = on;
  document.getElementById('pay-usd-opt').classList.toggle('selected', on);
  document.getElementById('pay-mix-section').style.display = on ? 'none' : '';
  renderCart();
}

// ── PAY MIX: AGREGAR / QUITAR ENTRADAS ──
const PAY_TYPE_ORDER = ['trans-ars', 'echeck-propio', 'cheque-fisico', 'echeck-terceros'];

function togglePayType(type, checked) {
  if (checked) {
    payMix.push({ id: _pmId++, type, pct: 0, days: 30 });
  } else {
    payMix = payMix.filter(m => m.type !== type);
    // Si quedó vacío, reactivar trans-ars con 0%
    if (payMix.length === 0) payMix.push({ id: _pmId++, type: 'trans-ars', pct: 0, days: 0 });
  }
  renderPayMix();
  updateAllocBar();
  renderCart();
}

function addPayEntry(type) {
  payMix.push({ id: _pmId++, type, pct: 0, days: 30 });
  renderPayMix();
  updateAllocBar();
  renderCart();
}

function removePayEntry(id) {
  const entry = payMix.find(m => m.id === id);
  if (!entry) return;
  const siblings = payMix.filter(m => m.type === entry.type);
  if (siblings.length <= 1) return; // no quitar la última instancia del tipo
  payMix = payMix.filter(m => m.id !== id);
  renderPayMix();
  updateAllocBar();
  renderCart();
}

function renderPayMix() {
  const container = document.getElementById('pay-mix-entries');
  if (!container) return;
  container.innerHTML = '';

  PAY_TYPE_ORDER.forEach(type => {
    const pm = PAY_METHODS[type];
    const instances = payMix.filter(m => m.type === type);
    const isActive = instances.length > 0;
    const isMulti = pm.perDay > 0; // cheques pueden repetirse

    const section = document.createElement('div');
    section.className = 'pay-type-section' + (isActive ? ' active' : '');
    section.id = 'pts-' + type;

    // ── Header: checkbox + nombre + badge ──
    section.innerHTML = `
      <div class="pay-type-header">
        <input type="checkbox" id="ptcb-${type}" ${isActive ? 'checked' : ''}
               onchange="togglePayType('${type}', this.checked)"/>
        <div class="pay-type-info">
          <span class="pay-opt-name">${pm.icon} ${pm.name}</span>
          <span class="pay-opt-badge ${pm.badgeCls}">${pm.badge}</span>
        </div>
      </div>`;

    // ── Instancias (solo si activo) ──
    if (isActive) {
      const list = document.createElement('div');
      list.className = 'pay-instance-list';

      instances.forEach((m, idx) => {
        const hasDays = pm.perDay > 0;
        const canRemove = instances.length > 1;
        const row = document.createElement('div');
        row.className = 'pay-instance-row';
        row.id = 'pir-' + m.id;
        row.innerHTML =
          (instances.length > 1 ? `<span class="pay-inst-num">#${idx + 1}</span>` : '') +
          `<div class="pay-mix-inp-group"><label>%</label>
             <input class="pay-mix-inp" type="number" id="pm-pct-${m.id}" min="0" max="100" step="1"
                    value="${m.pct.toFixed(1)}" oninput="updatePayPct(${m.id},this.value)"/>
           </div>
           <div class="pay-mix-inp-group"><label>USD</label>
             <input class="pay-mix-inp wide" type="number" id="pm-amt-${m.id}" min="0" step="0.01"
                    placeholder="—" oninput="updatePayAmt(${m.id},this.value)"/>
           </div>` +
          (hasDays
            ? `<div class="pay-mix-inp-group"><label>Días</label>
                 <input class="pay-days-inp" type="number" id="pm-days-${m.id}" min="1" max="360"
                        value="${m.days}" oninput="updatePayDays(${m.id},this.value)"/>
               </div>`
            : '') +
          (canRemove
            ? `<button class="pay-remove-btn" onclick="removePayEntry(${m.id})" title="Quitar">×</button>`
            : '');
        list.appendChild(row);
      });

      section.appendChild(list);

      // Botón "+ agregar otra instancia" (solo para tipos multi)
      if (isMulti) {
        const addBtn = document.createElement('button');
        addBtn.className = 'pay-add-instance-btn';
        addBtn.textContent = '+ Agregar otro';
        addBtn.onclick = () => addPayEntry(type);
        section.appendChild(addBtn);
      }
    }

    container.appendChild(section);
  });

  syncAmounts();
}

function updatePayPct(id, val) {
  const m = payMix.find(x => x.id === id);
  if (!m) return;
  m.pct = Math.max(0, Math.min(100, parseFloat(val) || 0));
  const total = getCartTotal();
  if (total > 0) {
    const el = document.getElementById('pm-amt-' + id);
    if (el) el.value = (total * m.pct / 100).toFixed(2);
  }
  updateAllocBar();
  renderCart();
}

function updatePayAmt(id, val) {
  const total = getCartTotal();
  if (total <= 0) return;
  const m = payMix.find(x => x.id === id);
  if (!m) return;
  const amt = Math.max(0, parseFloat(val) || 0);
  m.pct = Math.min(100, amt / total * 100);
  const el = document.getElementById('pm-pct-' + id);
  if (el) el.value = m.pct.toFixed(1);
  updateAllocBar();
  renderCart();
}

function updatePayDays(id, val) {
  const m = payMix.find(x => x.id === id);
  if (!m) return;
  m.days = Math.max(1, parseInt(val) || 30);
  renderCart();
}

function getCartTotal() {
  let sub = 0, iva = 0;
  cart.forEach(p => { sub += p.price * p.qty; iva += p.price * p.qty * p.iva; });
  return sub + iva;
}

function updateAllocBar() {
  const total = payMix.reduce((s, m) => s + m.pct, 0);
  const pct = Math.min(total, 100);
  const fill = document.getElementById('pay-alloc-fill');
  const lbl  = document.getElementById('pay-alloc-label');
  fill.style.width = pct + '%';
  if (Math.abs(total - 100) < 0.1) {
    fill.style.background = '#22c55e';
    lbl.className = 'pay-alloc-label ok';
    lbl.innerHTML = '<span>Asignado</span><span>100% ✓</span>';
  } else if (total > 100) {
    fill.style.background = '#ef4444';
    lbl.className = 'pay-alloc-label over';
    lbl.innerHTML = `<span>Asignado</span><span>${total.toFixed(1)}% — excede 100%</span>`;
  } else {
    fill.style.background = '#f59e0b';
    lbl.className = 'pay-alloc-label';
    lbl.innerHTML = `<span>Asignado</span><span>${total.toFixed(1)}% — faltan ${(100 - total).toFixed(1)}%</span>`;
  }
}

function syncAmounts() {
  const total = getCartTotal();
  if (total <= 0) return;
  payMix.forEach(m => {
    const el = document.getElementById('pm-amt-' + m.id);
    if (el) el.value = (total * m.pct / 100).toFixed(2);
  });
}

function getPayInfo() {
  if (isUsdMode) {
    return { totalDeduction: 0, usdBonus: true, isValid: true, label: 'Transferencia / depósito USD', parts: [] };
  }
  const activeParts = payMix
    .filter(m => m.pct > 0)
    .map(m => {
      const pm = PAY_METHODS[m.type];
      const days = Math.max(1, m.days || 1);
      const ded = pm.baseDeduction + days * pm.perDay;
      return { id: m.id, type: m.type, pm, pct: m.pct, days, ded };
    });
  const totalPct = payMix.reduce((s, m) => s + m.pct, 0);
  const totalDeduction = activeParts.reduce((s, p) => s + (p.pct / 100) * p.ded, 0);
  const isValid = Math.abs(totalPct - 100) < 0.1 && payMix.length > 0;
  const label = activeParts.map(p => `${p.pm.label} (${p.pct.toFixed(0)}%)`).join(' + ');
  return { totalDeduction, usdBonus: false, isValid, label, parts: activeParts };
}

// ── FORMAT ──
function fmtUSD(n) {
  return 'USD ' + n.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

// ── CATEGORIES ──
function getCategories() {
  return [...new Set(products.map(p=>p.cat))].sort();
}

function populateCatFilter() {
  const sel = document.getElementById('cat-filter');
  const val = sel.value;
  sel.innerHTML = '<option value="">Todas las categorías</option>';
  getCategories().forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    if (c === val) o.selected = true;
    sel.appendChild(o);
  });
}

// ── FILTER & RENDER PRODUCTS ──
function filterProducts() {
  const q = document.getElementById('search').value.toLowerCase().trim();
  const cat = document.getElementById('cat-filter').value;
  filtered = products.filter(p => {
    const matchCat = !cat || p.cat === cat;
    const matchQ = !q || p.model.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q);
    return matchCat && matchQ;
  });
  currentPage = 1;
  renderProducts();
}

function renderProducts() {
  const tbody = document.getElementById('prod-tbody');
  const placeholder = document.getElementById('prod-placeholder');
  const tableWrap = document.getElementById('prod-table-wrap');
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (currentPage-1)*PAGE_SIZE;
  const slice = filtered.slice(start, start+PAGE_SIZE);

  const q = document.getElementById('search').value.trim();
  const cat = document.getElementById('cat-filter').value;
  const isFiltering = q || cat;

  if (!isFiltering) {
    placeholder.style.display = '';
    tableWrap.style.display = 'none';
    document.getElementById('prod-count').textContent = '';
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  placeholder.style.display = 'none';
  tableWrap.style.display = '';
  document.getElementById('prod-count').textContent = `${total} de ${products.length} productos`;

  tbody.innerHTML = '';

  if (total === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" style="text-align:center;padding:2rem;color:var(--s400);font-size:.88rem">
      Sin resultados para la búsqueda actual.
      <button onclick="clearFilters()" style="background:none;border:none;color:var(--b600);cursor:pointer;text-decoration:underline;font-size:.88rem">Limpiar filtros</button>
    </td>`;
    tbody.appendChild(tr);
    renderPagination(0);
    return;
  }

  let lastCat = '';
  slice.forEach(p => {
    if (p.cat !== lastCat) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" class="section-title">${p.cat}</td>`;
      tbody.appendChild(tr);
      lastCat = p.cat;
    }
    const inCart = cart.find(c=>c.id===p.id);
    const priceNet = p.price;
    const priceIva = priceNet ? priceNet * (1 + p.iva) : null;
    const isPanel = p.cat.includes('AMERISOLAR') || p.cat.includes('RISEN') || p.desc.toLowerCase().includes('pallet');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-model">${p.model}${isPanel?'<span class="tag-panel">pallet</span>':''}</td>
      <td class="td-desc" title="${p.desc.replace(/"/g,'&quot;')}">${p.desc.substring(0,80)}${p.desc.length>80?'…':''}</td>
      <td class="td-price">${priceIva ? fmtUSD(priceIva) : '<span class="no-price">Consultar</span>'}</td>
      <td class="td-avail"><span class="${p.avail==='Disponible'?'av-ok':'av-no'}">${p.avail||'—'}</span></td>
      <td class="td-add">
        ${priceNet && p.avail === 'Disponible' ? `<div class="qty-wrap">
          <button class="qty-btn" onclick="changeQty(${p.id},-1)">−</button>
          <input class="qty-inp" id="qty-${p.id}" type="number" min="1" value="${inCart?inCart.qty:1}"/>
          <button class="qty-btn" onclick="changeQty(${p.id},1)">+</button>
        </div>
        <button class="btn-add ${inCart?'added':''}" onclick="addToCart(${p.id})" style="margin-top:4px">
          ${inCart?'✓ En pedido':'+ Agregar'}
        </button>` : priceNet ? '<span class="no-price">Sin stock</span>' : '<span class="no-price">Sin precio</span>'}
      </td>`;
    tbody.appendChild(tr);
  });

  renderPagination(pages);
}

function clearFilters() {
  document.getElementById('search').value = '';
  document.getElementById('cat-filter').value = '';
  filterProducts();
}

function changeQty(id, delta) {
  const inp = document.getElementById('qty-'+id);
  if (!inp) return;
  let v = parseInt(inp.value)||1;
  v = Math.max(1, v+delta);
  inp.value = v;
  const ci = cart.findIndex(c=>c.id===id);
  if (ci > -1) { cart[ci].qty = v; renderCart(); }
}

function renderPagination(pages) {
  const div = document.getElementById('pagination');
  if (pages <= 1) { div.innerHTML=''; return; }
  let h = '';
  if (currentPage > 1) h += `<button class="page-btn" onclick="goPage(${currentPage-1})">‹</button>`;
  const range = [];
  for (let i=1;i<=pages;i++) {
    if (i===1||i===pages||Math.abs(i-currentPage)<=2) range.push(i);
    else if (range[range.length-1]!=='…') range.push('…');
  }
  range.forEach(r => {
    if (r==='…') h+=`<span style="padding:0 4px;color:var(--s400)">…</span>`;
    else h+=`<button class="page-btn ${r===currentPage?'active':''}" onclick="goPage(${r})">${r}</button>`;
  });
  if (currentPage < pages) h += `<button class="page-btn" onclick="goPage(${currentPage+1})">›</button>`;
  h += `<span class="page-info">Pág. ${currentPage}/${pages}</span>`;
  div.innerHTML = h;
}

function goPage(n) { currentPage=n; renderProducts(); window.scrollTo(0,0); }

// ── CART ──
function addToCart(id) {
  const p = products.find(x=>x.id===id);
  if (!p || !p.price || p.avail !== 'Disponible') return;
  const inp = document.getElementById('qty-'+id);
  const qty = inp ? Math.max(1,parseInt(inp.value)||1) : 1;
  const ci = cart.findIndex(c=>c.id===id);
  if (ci > -1) cart[ci].qty = qty;
  else cart.push({...p, qty});
  renderCart();
  renderProducts();
}

function removeFromCart(id) {
  cart = cart.filter(c=>c.id!==id);
  renderCart();
  renderProducts();
}

function updateCartQty(id, val) {
  const ci = cart.findIndex(c=>c.id===id);
  if (ci>-1) { cart[ci].qty = Math.max(1,parseInt(val)||1); renderCart(); }
}

function clearCart() {
  cart = [];
  renderCart();
  renderProducts();
}

function renderCart() {
  const div = document.getElementById('cart-content');
  const sumBox = document.getElementById('summary-box');
  const btnWA = document.getElementById('btn-wa');

  if (cart.length === 0) {
    div.innerHTML = '<div class="cart-empty">Agregá productos desde el catálogo</div>';
    sumBox.style.display = 'none';
    btnWA.disabled = true;
    return;
  }

  let subtotalNet = 0, totalIva = 0;
  let rows = '';
  cart.forEach(p => {
    const lineNet = p.price * p.qty;
    const lineIva = lineNet * p.iva;
    subtotalNet += lineNet;
    totalIva += lineIva;
    rows += `<tr>
      <td><div class="cart-model">${p.model}</div><div class="cart-desc" title="${p.desc}">${p.desc}</div></td>
      <td style="text-align:center"><div style="display:flex;align-items:center;gap:3px;justify-content:center">
        <button class="qty-btn" onclick="updateCartQty(${p.id},${p.qty-1})">−</button>
        <input class="qty-inp" value="${p.qty}" onchange="updateCartQty(${p.id},this.value)" style="width:36px"/>
        <button class="qty-btn" onclick="updateCartQty(${p.id},${p.qty+1})">+</button>
      </div></td>
      <td class="cart-price" style="text-align:right">${fmtUSD(lineNet)}</td>
      <td><button class="btn-remove" onclick="removeFromCart(${p.id})">✕</button></td>
    </tr>`;
  });

  const totalConIva = subtotalNet + totalIva;
  const volDiscPct  = getDiscount(totalConIva);
  const volDiscAmt  = totalConIva * volDiscPct / 100;

  // Payment method adjustments
  const { totalDeduction, usdBonus, isValid, label: payLabel, parts } = getPayInfo();
  const netDiscPct = volDiscPct - totalDeduction + (usdBonus ? 1 : 0);
  const netDiscAmt = totalConIva * netDiscPct / 100;
  const finalTotalCorrected = totalConIva - netDiscAmt;

  syncAmounts();

  div.innerHTML = `<table class="cart-table">
    <thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Subtotal</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table>`;

  document.getElementById('s-subtotal').textContent   = fmtUSD(subtotalNet);
  document.getElementById('s-iva').textContent        = fmtUSD(totalIva);
  document.getElementById('s-total-iva').textContent  = fmtUSD(totalConIva);
  document.getElementById('s-desc').textContent       = `−${fmtUSD(volDiscAmt)} (${volDiscPct.toFixed(2)}%)`;
  document.getElementById('s-final').textContent      = fmtUSD(finalTotalCorrected);
  document.getElementById('disc-bar').style.width     = (Math.max(0, Math.min(netDiscPct,10))/10*100)+'%';
  document.getElementById('disc-label').textContent   = netDiscPct > 0
    ? `Descuento neto: ${netDiscPct.toFixed(2)}%`
    : netDiscPct < 0
      ? `Costo financiero neto: +${Math.abs(netDiscPct).toFixed(2)}%`
      : 'Sin descuento neto';

  // Deduction row
  const payRow = document.getElementById('s-pay-row');
  const usdRow = document.getElementById('s-usd-row');
  if (totalDeduction > 0) {
    const dedDetail = parts.filter(p => p.ded > 0)
      .map(p => `${p.pm.label} ${p.pct.toFixed(0)}%: ${p.ded.toFixed(2)}%`).join(' · ');
    document.getElementById('s-pay-label').textContent = `Deducción pago (${dedDetail})`;
    document.getElementById('s-pay-val').textContent   = `+${fmtUSD(totalConIva * totalDeduction / 100)} (${totalDeduction.toFixed(2)}%)`;
    payRow.style.display = 'flex';
  } else { payRow.style.display = 'none'; }

  if (usdBonus) {
    document.getElementById('s-usd-val').textContent = `−${fmtUSD(totalConIva * 0.01)} (1.00%)`;
    usdRow.style.display = 'flex';
  } else { usdRow.style.display = 'none'; }

  // Info box
  const info = document.getElementById('pay-info-box');
  if (!isValid && !isUsdMode) {
    info.className = 'pay-info-box show';
    const tot = payMix.reduce((s,m)=>s+m.pct,0);
    info.innerHTML = `⚠️ Los porcentajes asignados suman <strong>${tot.toFixed(1)}%</strong>. Deben sumar exactamente <strong>100%</strong> para poder enviar el pedido.`;
  } else if (netDiscPct < 0) {
    info.className = 'pay-info-box show';
    info.innerHTML = `⚠️ La deducción por forma de pago (<strong>${totalDeduction.toFixed(2)}%</strong>) supera el descuento por volumen (<strong>${volDiscPct.toFixed(2)}%</strong>). El costo financiero neto de <strong>${Math.abs(netDiscPct).toFixed(2)}%</strong> se traslada al cliente.`;
  } else if (totalDeduction > 0) {
    info.className = 'pay-info-box show';
    info.innerHTML = `⚠️ Descuento por volumen: <strong>${volDiscPct.toFixed(2)}%</strong> · Deducción ponderada: <strong>${totalDeduction.toFixed(2)}%</strong> → descuento neto: <strong>${netDiscPct.toFixed(2)}%</strong>.`;
  } else if (usdBonus) {
    info.className = 'pay-info-box show';
    info.innerHTML = `💵 Pago en USD: descuento por volumen <strong>${volDiscPct.toFixed(2)}%</strong> + 1.00% bonus = descuento neto <strong>${netDiscPct.toFixed(2)}%</strong>.`;
  } else {
    info.className = 'pay-info-box';
  }

  sumBox.style.display = 'block';
  btnWA.disabled = !isValid && !isUsdMode;
}

// ── WHATSAPP ──
function enviarWA() {
  const nombre  = document.getElementById('cl-nombre').value.trim();
  const empresa = document.getElementById('cl-empresa').value.trim();
  const tel     = document.getElementById('cl-tel').value.trim();
  const dir     = document.getElementById('cl-dir').value.trim();

  if (!nombre) { alert('Por favor ingresá tu nombre.'); document.getElementById('cl-nombre').focus(); return; }
  if (cart.length===0) { alert('El pedido está vacío.'); return; }

  const { totalDeduction, usdBonus, isValid, label: payLabel, parts } = getPayInfo();
  if (!isValid && !isUsdMode) { alert('Los porcentajes de forma de pago deben sumar 100% antes de enviar.'); return; }

  let subtotalNet=0, totalIva=0;
  cart.forEach(p=>{ subtotalNet+=p.price*p.qty; totalIva+=p.price*p.qty*p.iva; });
  const totalConIva = subtotalNet + totalIva;
  const volDiscPct  = getDiscount(totalConIva);
  const volDiscAmt  = totalConIva * volDiscPct / 100;
  const netDiscPct  = volDiscPct - totalDeduction + (usdBonus ? 1 : 0);
  const netDiscAmt  = totalConIva * netDiscPct / 100;
  const finalTotal  = totalConIva - netDiscAmt;

  const fecha = new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});

  let items = '';
  cart.forEach(p=>{
    const lineFull = p.price * p.qty * (1 + p.iva);
    items += `• *${p.model}* x${p.qty} → ${fmtUSD(lineFull)}\n`;
  });

  let payDetail = '';
  if (isUsdMode) {
    payDetail = 'Transferencia / depósito USD (100%)';
  } else {
    payDetail = parts.map(p => {
      const daysTxt = p.pm.perDay > 0 ? ` · ${p.days} días` : '';
      return `${p.pm.label} ${p.pct.toFixed(0)}%${daysTxt}`;
    }).join(' + ');
  }

  const dedLine = totalDeduction > 0
    ? `• Deducción ponderada (${totalDeduction.toFixed(2)}%): +${fmtUSD(totalConIva*totalDeduction/100)}\n`
    : '';
  const usdLine = usdBonus ? `• Bonus pago USD (1.00%): −${fmtUSD(totalConIva*0.01)}\n` : '';

  const msg = `🛒 *NUEVO PEDIDO TEDLE*\n📅 ${fecha}\n\n` +
    `👤 *Datos del cliente:*\n• Nombre: ${nombre}\n${empresa?`• Empresa: ${empresa}\n`:''}${tel?`• Teléfono: ${tel}\n`:''}${dir?`• Entrega: ${dir}\n`:''}\n` +
    `💳 *Forma de pago:* ${payDetail}\n\n` +
    `📦 *Detalle del pedido:*\n${items}\n` +
    `💰 *Resumen:*\n• Subtotal s/IVA: ${fmtUSD(subtotalNet)}\n• IVA: ${fmtUSD(totalIva)}\n• Total c/IVA: ${fmtUSD(totalConIva)}\n• Desc. por volumen (${volDiscPct.toFixed(2)}%): −${fmtUSD(volDiscAmt)}\n${dedLine}${usdLine}• *TOTAL A PAGAR: ${fmtUSD(finalTotal)}* _(desc. neto ${netDiscPct.toFixed(2)}%)_`;

  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
}



// ── INIT ──
fetch('productos.json')
  .then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(data => {
    products = data.productos ?? data;
    if (data.fecha_actualizacion) {
      const el = document.getElementById('fecha-actualizacion');
      if (el) el.textContent = data.fecha_actualizacion;
    }
    populateCatFilter();
    filterProducts();
    renderPayMix();
    updateAllocBar();
  })
  .catch(err => {
    console.error('Error cargando productos.json:', err);
    document.getElementById('prod-placeholder').innerHTML =
      '<span style="color:#ef4444">⚠️ No se pudo cargar el catálogo. ' +
      'Abrí el archivo desde un servidor web, no directo desde el disco.</span>';
  });
