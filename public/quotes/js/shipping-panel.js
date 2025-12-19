/*
 * Shipping Rate Browser (Kanva Botanicals)
 * Modern UI with ShipStation API v2 rate fetching, toast notifications, filtering,
 * selection callback to the quote calculator, and lightweight profile save/load.
 */
(function(){
  // Toast notifications
  function ensureToastRoot(){
    let root = document.getElementById('toast-root');
    if (!root){
      root = document.createElement('div');
      root.id = 'toast-root';
      root.style.position = 'fixed';
      root.style.top = '16px';
      root.style.right = '16px';
      root.style.zIndex = '9999';
      root.style.display = 'flex';
      root.style.flexDirection = 'column';
      root.style.gap = '8px';
      document.body.appendChild(root);
    }
    return root;
  }

  function showNotification(message, type = 'info', timeout = 3000){
    const root = ensureToastRoot();
    const el = document.createElement('div');
    el.style.minWidth = '260px';
    el.style.maxWidth = '420px';
    el.style.padding = '12px 14px';
    el.style.borderRadius = '10px';
    el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)';
    el.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
    el.style.fontSize = '14px';
    el.style.color = '#0b1f0a';
    el.style.background = type === 'success' ? '#eaffea' : type === 'error' ? '#feecec' : type === 'warning' ? '#fff7e6' : '#eef2ff';
    el.style.border = `1px solid ${type === 'success' ? '#86efac' : type === 'error' ? '#fecaca' : type === 'warning' ? '#fde68a' : '#c7d2fe'}`;
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(()=> el.remove(), 350); }, timeout);
    // expose globally
    window.showNotification = showNotification;
  }

  // Build UI container
  function buildUI(){
    const container = document.createElement('div');
    container.className = 'rate-browser-container';
    container.innerHTML = `
      <style>
        .rate-browser-container{max-width:1200px;margin:16px auto;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);overflow:hidden}
        .rate-browser-header{background:linear-gradient(135deg,#93D500,#7AB500);color:#fff;padding:20px 24px;display:flex;align-items:center;justify-content:space-between}
        .rate-browser-header h2{font-size:20px;font-weight:600;display:flex;align-items:center;gap:10px;margin:0}
        .rate-browser-header .icon{font-size:24px}
        .close-btn{background:rgba(255,255,255,0.2);border:none;color:#fff;width:32px;height:32px;border-radius:6px;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;transition:background .2s}
        .close-btn:hover{background:rgba(255,255,255,0.3)}
        .rate-browser-content{display:flex;gap:24px;padding:24px}
        .config-panel{flex:0 0 350px;background:#f8f9fa;border-radius:8px;padding:20px}
        .config-section{margin-bottom:24px}
        .config-section h3{font-size:14px;font-weight:600;color:#344054;margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px}
        .form-group{margin-bottom:16px}
        .form-group label{display:block;font-size:14px;font-weight:500;color:#344054;margin-bottom:6px}
        .form-control{width:100%;padding:8px 12px;border:1px solid #d0d5dd;border-radius:6px;font-size:14px}
        .form-control:focus{outline:none;border-color:#93D500;box-shadow:0 0 0 3px rgba(147,213,0,0.1)}
        .input-group{display:flex;gap:8px;align-items:center}
        .input-group input{flex:1}
        .input-group .unit{color:#667085;font-size:14px;white-space:nowrap}
        .checkbox-group{display:flex;align-items:center;gap:8px;margin-top:8px}
        .browse-rates-btn{width:100%;background:#93D500;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;transition:all .2s;margin-top:20px}
        .browse-rates-btn:hover{background:#7AB500;transform:translateY(-1px);box-shadow:0 4px 12px rgba(147,213,0,.3)}
        .browse-rates-btn:disabled{background:#e5e7eb;color:#9ca3af;cursor:not-allowed;transform:none}
        .results-panel{flex:1;min-height:400px}
        .results-header{border-bottom:1px solid #e5e7eb;padding-bottom:16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}
        .results-header h3{font-size:18px;font-weight:600;color:#111827;margin:0}
        .view-selector{display:flex;gap:8px;align-items:center}
        .empty-state{text-align:center;padding:60px 20px;color:#6b7280}
        .empty-state .icon{font-size:48px;margin-bottom:16px;opacity:.5}
        .loading-state{text-align:center;padding:60px 20px}
        .spinner{width:40px;height:40px;border:4px solid #e5e7eb;border-top-color:#93D500;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px}
        @keyframes spin{to{transform:rotate(360deg)}}
        .rates-table{width:100%;border-collapse:collapse}
        .rates-table thead{background:#f9fafb}
        .rates-table th{text-align:left;padding:12px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb}
        .rates-table tbody tr{border-bottom:1px solid #f3f4f6;transition:background .2s}
        .rates-table tbody tr:hover{background:#f9fafb}
        .rates-table td{padding:16px 12px;font-size:14px;color:#111827}
        .price{font-size:18px;font-weight:600;color:#059669}
        .delivery-days{display:flex;align-items:center;gap:6px}
        .select-rate-btn{background:#fff;border:2px solid #93D500;color:#93D500;padding:6px 16px;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer;transition:all .2s}
        .select-rate-btn:hover{background:#93D500;color:#fff}
        .error-state{background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin-top:20px}
        .error-state h4{color:#dc2626;font-size:14px;font-weight:600;margin:0 0 8px}
        .error-state p{color:#7f1d1d;font-size:14px;margin:0}
      </style>
      <div class="rate-browser-header">
        <h2><span class="icon">📦</span>Shipping Rate Browser</h2>
        <button type="button" class="close-btn" id="rb_close">×</button>
      </div>
      <div class="rate-browser-content">
        <div class="config-panel">
          <div class="config-section">
            <h3>Ship From</h3>
            <div class="form-group">
              <label>Postal Code</label>
              <input type="text" id="from-postal" class="form-control" value="83704" placeholder="Enter postal code">
            </div>
          </div>
          <div class="config-section">
            <h3>Ship To</h3>
            <div class="form-group">
              <label>Country</label>
              <select id="to-country" class="form-control">
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="MX">Mexico</option>
              </select>
            </div>
            <div class="form-group">
              <label>Postal Code</label>
              <input type="text" id="to-postal" class="form-control" placeholder="Enter postal code">
            </div>
            <div class="checkbox-group">
              <input type="checkbox" id="residential">
              <label for="residential">Residential Address</label>
            </div>
          </div>
          <div class="config-section">
            <h3>Package Information</h3>
            <div class="form-group">
              <label>Weight</label>
              <div class="input-group">
                <input type="number" id="weight-lbs" class="form-control" value="5" min="0">
                <span class="unit">lbs</span>
                <input type="number" id="weight-oz" class="form-control" value="0" min="0" max="15">
                <span class="unit">oz</span>
              </div>
            </div>
            <div class="form-group">
              <label>Dimensions (inches)</label>
              <div class="input-group">
                <input type="number" id="dim-length" class="form-control" placeholder="L" value="12">
                <span class="unit">×</span>
                <input type="number" id="dim-width" class="form-control" placeholder="W" value="8">
                <span class="unit">×</span>
                <input type="number" id="dim-height" class="form-control" placeholder="H" value="6">
              </div>
            </div>
            <div class="form-group">
              <label>Package Type</label>
              <select id="package-type" class="form-control">
                <option value="package">Package</option>
                <option value="envelope">Envelope</option>
                <option value="box">Box</option>
                <option value="pallet">Pallet</option>
              </select>
            </div>
          </div>
          <div class="config-section">
            <h3>Profile</h3>
            <div class="form-group">
              <label>Profile Key</label>
              <input type="text" id="profile-key" class="form-control" placeholder="Company or email">
            </div>
            <div class="input-group">
              <button class="browse-rates-btn" id="rb_save_profile" style="background:#e5e7eb;color:#111827;border:1px solid #d1d5db">Save Profile</button>
              <button class="browse-rates-btn" id="rb_load_profile" style="background:#e5e7eb;color:#111827;border:1px solid #d1d5db">Load Profile</button>
            </div>
          </div>
          <button class="browse-rates-btn" id="rb_fetch">Get Shipping Rates</button>
        </div>
        <div class="results-panel">
          <div class="results-header">
            <h3>Available Rates</h3>
            <div class="view-selector">
              <label for="rate-filter">View:</label>
              <select id="rate-filter">
                <option value="all">All Rates</option>
                <option value="ground">Ground Only</option>
                <option value="express">Express Only</option>
                <option value="cheapest">Cheapest First</option>
                <option value="fastest">Fastest First</option>
              </select>
            </div>
          </div>
          <div id="results-container">
            <div class="empty-state"><div class="icon">📦</div><p>Enter shipment details and click "Get Shipping Rates" to view available options</p></div>
          </div>
        </div>
      </div>
    `;
    return container;
  }

  // State
  let currentRates = [];

  function buildShipmentFromForm(){
    const fromPostal = document.getElementById('from-postal').value.trim();
    const toPostal = document.getElementById('to-postal').value.trim();
    const toCountry = document.getElementById('to-country').value;
    const isResidential = document.getElementById('residential').checked;
    const weightLbs = parseFloat(document.getElementById('weight-lbs').value) || 0;
    const weightOz = parseFloat(document.getElementById('weight-oz').value) || 0;
    const totalOunces = Math.max(0, (weightLbs * 16) + weightOz);
    const length = parseFloat(document.getElementById('dim-length').value) || 12;
    const width = parseFloat(document.getElementById('dim-width').value) || 8;
    const height = parseFloat(document.getElementById('dim-height').value) || 6;

    if (!toPostal){ throw new Error('Destination postal code is required'); }
    if (!fromPostal){ showNotification('From postal code not set. Using default warehouse zip.', 'warning'); }

    return {
      shipFrom: { postalCode: fromPostal || undefined, countryCode: 'US' },
      shipTo: { postalCode: toPostal, countryCode: toCountry, residential: isResidential },
      packages: [{
        weight: { value: totalOunces, units: 'ounces' },
        dimensions: { length, width, height, units: 'inches' }
      }]
    };
  }

  function getCarrierLabel(code){
    const m = { ups: '🚚 UPS', fedex: '✈️ FedEx', usps: '📮 USPS', dhl: '📦 DHL', ontrac: '🚛 OnTrac' };
    return m[String(code||'').toLowerCase()] || `📦 ${String(code||'').toUpperCase()}`;
  }

  function showLoadingState(){
    const container = document.getElementById('results-container');
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Fetching shipping rates...</p></div>`;
  }

  function showErrorState(message){
    const container = document.getElementById('results-container');
    container.innerHTML = `<div class="error-state"><h4>Unable to fetch rates</h4><p>${message}</p></div>`;
  }

  function displayRates(rates){
    const container = document.getElementById('results-container');
    if (!Array.isArray(rates) || !rates.length){
      container.innerHTML = `<div class="empty-state"><div class="icon">📭</div><p>No shipping rates available for this route</p></div>`;
      return;
    }

    // normalize and sort cheapest
    const sorted = [...rates].sort((a,b)=> (a.shipmentCost||0) - (b.shipmentCost||0));
    const rows = sorted.map(rate => `
      <tr>
        <td>${getCarrierLabel(rate.carrierCode)}</td>
        <td><div class="service-name">${rate.serviceName || rate.serviceCode}</div><div class="service-code" style="font-size:12px;color:#6b7280">${rate.serviceCode||''}</div></td>
        <td><div class="price">$${Number(rate.shipmentCost||0).toFixed(2)}</div></td>
        <td><div class="delivery-days"><span class="delivery-icon">📅</span>${rate.deliveryDays ? `${rate.deliveryDays} days` : 'N/A'}</div></td>
        <td><button class="select-rate-btn" data-service="${encodeURIComponent(rate.serviceCode)}" data-cost="${Number(rate.shipmentCost||0)}">Select</button></td>
      </tr>
    `).join('');

    container.innerHTML = `
      <table class="rates-table">
        <thead><tr><th>Carrier</th><th>Service</th><th>Price</th><th>Delivery</th><th>Action</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    // Bind select buttons
    container.querySelectorAll('.select-rate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sc = decodeURIComponent(btn.getAttribute('data-service')||'');
        const cost = Number(btn.getAttribute('data-cost')||0);
        selectRate(sc, cost);
      });
    });
  }

  async function fetchShippingRates(){
    try{
      showLoadingState();
      const shipment = buildShipmentFromForm();
      if (!window.shipStation || !window.shipStation.isConfigured){
        throw new Error('ShipStation integration is not configured. Please configure it in the admin panel.');
      }
      const rates = await window.shipStation.getRates(shipment);
      currentRates = Array.isArray(rates) ? rates : (rates?.rates || []);
      displayRates(currentRates);
      showNotification('Rates loaded', 'success');
    }catch(err){
      console.error('Error fetching rates:', err);
      showErrorState(err?.message || 'Unknown error');
      showNotification(err?.message || 'Failed to fetch rates', 'error');
    }
  }

  function selectRate(serviceCode, cost){
    // Notify parent (Copper CRM) if embedded
    try{
      if (window.parent && window.parent !== window){
        window.parent.postMessage({ type: 'SHIPPING_RATE_SELECTED', data: { serviceCode, shippingCost: cost } }, '*');
      }
    }catch{}
    // Add to quote calculator if available
    if (window.Calculator && typeof window.Calculator.addShippingToQuote === 'function'){
      try{ window.Calculator.addShippingToQuote(cost); }catch{}
    }
    showNotification(`Selected ${serviceCode} - $${Number(cost).toFixed(2)}`, 'success');
  }

  function closeRateBrowser(){
    const root = document.querySelector('.rate-browser-container');
    if (window.parent && window.parent !== window){
      try{ window.parent.postMessage({ type: 'CLOSE_RATE_BROWSER' }, '*'); }catch{}
    }
    if (root) root.style.display = 'none';
  }

  function applyFilter(){
    const sel = document.getElementById('rate-filter');
    const filter = sel ? sel.value : 'all';
    let filtered = [...currentRates];
    switch(filter){
      case 'ground':
        filtered = filtered.filter(r => String(r.serviceCode||'').toLowerCase().includes('ground'));
        break;
      case 'express':
        filtered = filtered.filter(r => {
          const s = String(r.serviceCode||'').toLowerCase();
          return s.includes('express') || s.includes('priority');
        });
        break;
      case 'cheapest':
        filtered.sort((a,b)=>(a.shipmentCost||0)-(b.shipmentCost||0));
        break;
      case 'fastest':
        filtered.sort((a,b)=>(a.deliveryDays||999)-(b.deliveryDays||999));
        break;
    }
    displayRates(filtered);
  }

  function saveProfileLocal(){
    const key = (document.getElementById('profile-key')?.value || '').trim() || (document.getElementById('companyName')?.value || '').trim() || 'default';
    const profile = {
      toPostal: document.getElementById('to-postal')?.value || '',
      toCountry: document.getElementById('to-country')?.value || 'US',
      residential: !!document.getElementById('residential')?.checked,
      fromPostal: document.getElementById('from-postal')?.value || '83704',
      weightLbs: document.getElementById('weight-lbs')?.value || '5',
      weightOz: document.getElementById('weight-oz')?.value || '0',
      dimL: document.getElementById('dim-length')?.value || '12',
      dimW: document.getElementById('dim-width')?.value || '8',
      dimH: document.getElementById('dim-height')?.value || '6',
      pkgType: document.getElementById('package-type')?.value || 'package'
    };
    localStorage.setItem('kb_shipping_profile_'+key, JSON.stringify(profile));
    showNotification('Profile saved', 'success');
  }

  function loadProfileLocal(){
    const key = (document.getElementById('profile-key')?.value || '').trim() || (document.getElementById('companyName')?.value || '').trim() || 'default';
    const raw = localStorage.getItem('kb_shipping_profile_'+key);
    if (!raw){ showNotification('No profile found for this key', 'warning'); return; }
    try{
      const p = JSON.parse(raw);
      if (p.toPostal) document.getElementById('to-postal').value = p.toPostal;
      if (p.toCountry) document.getElementById('to-country').value = p.toCountry;
      if (typeof p.residential === 'boolean') document.getElementById('residential').checked = p.residential;
      if (p.fromPostal) document.getElementById('from-postal').value = p.fromPostal;
      if (p.weightLbs) document.getElementById('weight-lbs').value = p.weightLbs;
      if (p.weightOz) document.getElementById('weight-oz').value = p.weightOz;
      if (p.dimL) document.getElementById('dim-length').value = p.dimL;
      if (p.dimW) document.getElementById('dim-width').value = p.dimW;
      if (p.dimH) document.getElementById('dim-height').value = p.dimH;
      if (p.pkgType) document.getElementById('package-type').value = p.pkgType;
      showNotification('Profile loaded', 'success');
    }catch{
      showNotification('Failed to parse saved profile', 'error');
    }
  }

  function init(){
    const ui = buildUI();
    // Prefer inserting near app content if available
    const app = document.getElementById('app');
    (app || document.body).appendChild(ui);

    // Bind events
    document.getElementById('rb_fetch').addEventListener('click', fetchShippingRates);
    document.getElementById('rate-filter').addEventListener('change', applyFilter);
    document.getElementById('rb_close').addEventListener('click', closeRateBrowser);
    document.getElementById('rb_save_profile').addEventListener('click', saveProfileLocal);
    document.getElementById('rb_load_profile').addEventListener('click', loadProfileLocal);

    // Auto-populate from CRM main form if available
    const company = document.getElementById('companyName');
    const profileKey = document.getElementById('profile-key');
    if (company && company.value && profileKey){ profileKey.value = company.value; }

    // Listen for messages from parent (e.g., Copper)
    window.addEventListener('message', (event) => {
      const msg = event && event.data;
      if (msg && msg.type === 'CUSTOMER_DATA'){
        const customer = msg.data || {};
        if (customer.postalCode) document.getElementById('to-postal').value = customer.postalCode;
        if (customer.country) document.getElementById('to-country').value = customer.country;
      }
    });

    // Expose helpers
    window.fetchShippingRates = fetchShippingRates;
    window.closeRateBrowser = closeRateBrowser;
    window.showNotification = showNotification; // ensured
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
