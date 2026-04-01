// GLOBALS
let chartInstance = null;
let topCustomersChart = null;
let topOfficesChart = null;
let orderTypeChart = null;
let customerYearlyChart = null;
let currentView = 'overview';
let currentMetric = 'value';
let rawData = [];
let selectedYearsSet = new Set();

// DOM Elements
const fileInput = document.getElementById('excelUpload');
const yearTrigger = document.getElementById('yearTrigger');
const yearDropdown = document.getElementById('yearDropdown');
const clearYearsBtn = document.getElementById('clearYearsBtn');
const selectedYearsTextSpan = document.getElementById('selectedYearsText');

const totalPOEl = document.getElementById('totalPO');
const totalOrdersEl = document.getElementById('totalOrders');
const avgPOEl = document.getElementById('avgPO');
const topCustomerEl = document.getElementById('topCustomer');
const topOfficeEl = document.getElementById('topOffice');
const topManagerEl = document.getElementById('topManager');
const customerCountSpan = document.getElementById('customerCountSpan');
const uploadStatusDiv = document.getElementById('uploadStatus');

// Customer Search Elements
const customerSearchInput = document.getElementById('customerSearchInput');
const searchCustomerBtn = document.getElementById('searchCustomerBtn');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const searchResultInfo = document.getElementById('searchResultInfo');
const customerChartContainer = document.getElementById('customerChartContainer');
const customerChartTitle = document.getElementById('customerChartTitle');
const customerStats = document.getElementById('customerStats');

// Helper Functions
function formatFY(value) {
  if (!value && value !== 0) return "Unknown FY";
  const str = String(value).trim();
  if (str === "") return "Unknown FY";
  
  if (str.length >= 4 && /^\d+$/.test(str)) {
    const start = str.slice(0, 2);
    const end = str.slice(2, 4);
    return `FY ${start}-${end}`;
  }
  if (str.match(/^\d{2}-\d{2}$/)) {
    return `FY ${str}`;
  }
  if (str.toUpperCase().startsWith('FY')) {
    return str.toUpperCase();
  }
  return `FY ${str}`;
}

function getAllYears() {
  if (!rawData.length) return [];
  return [...new Set(rawData.map(d => d.fy))].sort();
}

function toggleSelectAll() {
  const allYears = getAllYears();
  if (!allYears.length) return;
  const allSelected = allYears.every(year => selectedYearsSet.has(year));
  if (allSelected) {
    selectedYearsSet.clear();
  } else {
    allYears.forEach(year => selectedYearsSet.add(year));
  }
  rebuildYearFilterUI();
  refreshAll();
}

function rebuildYearFilterUI() {
  if (!rawData.length) {
    yearDropdown.innerHTML = '<div style="padding:12px;color:#6b7280;text-align:center;">No data</div>';
    selectedYearsTextSpan.innerText = 'Financial Years';
    return;
  }
  const uniqueYears = getAllYears();
  const allSelected = uniqueYears.length > 0 && uniqueYears.every(year => selectedYearsSet.has(year));
  let html = `
    <div class="select-all-option" id="selectAllOption">
      <input type="checkbox" id="selectAllCheckbox" ${allSelected ? 'checked' : ''}>
      <label for="selectAllCheckbox"><i class="fas fa-check-double"></i> Select All / None</label>
    </div>
    <div class="divider"></div>
  `;
  uniqueYears.forEach(year => {
    const isChecked = selectedYearsSet.has(year);
    const id = `year_${year.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}`;
    html += `
      <div class="year-option" data-year="${year}">
        <input type="checkbox" value="${year}" ${isChecked ? 'checked' : ''} id="${id}">
        <label for="${id}">${year}</label>
      </div>
    `;
  });
  yearDropdown.innerHTML = html;

  const selectAllOption = document.getElementById('selectAllOption');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  if (selectAllOption) {
    selectAllOption.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSelectAll();
    });
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        e.stopPropagation();
        toggleSelectAll();
      });
    }
  }
  document.querySelectorAll('.year-option').forEach(option => {
    const checkbox = option.querySelector('input');
    const year = option.getAttribute('data-year');
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        if (checkbox.checked) selectedYearsSet.add(year);
        else selectedYearsSet.delete(year);
        updateSelectedYearsText();
        refreshAll();
        const allYearsNow = getAllYears();
        const allSelectedNow = allYearsNow.length > 0 && allYearsNow.every(y => selectedYearsSet.has(y));
        const selectAllChk = document.getElementById('selectAllCheckbox');
        if (selectAllChk) selectAllChk.checked = allSelectedNow;
      });
    }
    option.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change'));
        }
      }
    });
  });
  updateSelectedYearsText();
}

function updateSelectedYearsText() {
  if (!rawData.length) {
    selectedYearsTextSpan.innerText = 'Financial Years';
    return;
  }
  const count = selectedYearsSet.size;
  const total = getAllYears().length;
  if (count === total) selectedYearsTextSpan.innerText = `All Years (${count})`;
  else if (count === 0) selectedYearsTextSpan.innerText = `No Years Selected`;
  else selectedYearsTextSpan.innerText = `${count} Year${count !== 1 ? 's' : ''} Selected`;
}

function getActiveYears() {
  return Array.from(selectedYearsSet);
}

function resetAllYears() {
  if (!rawData.length) return;
  const allYears = getAllYears();
  selectedYearsSet.clear();
  allYears.forEach(y => selectedYearsSet.add(y));
  rebuildYearFilterUI();
  refreshAll();
}

function getFilteredData() {
  const activeYears = getActiveYears();
  if (!rawData.length) return [];
  if (activeYears.length === 0) return [];
  return rawData.filter(d => activeYears.includes(d.fy));
}

// Event Listeners
yearTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  yearDropdown.classList.toggle('show');
});

document.addEventListener('click', (e) => {
  if (!yearDropdown.contains(e.target) && !yearTrigger.contains(e.target)) {
    yearDropdown.classList.remove('show');
  }
});

clearYearsBtn.addEventListener('click', () => resetAllYears());

// File Upload Handler - Column Mapping: B=FY, C=Office, D=Manager, F=Customer, G=Type, K=Price
function handleExcelUpload(file) {
  if (!file) return;
  uploadStatusDiv.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Parsing file...';
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
      
      if (!rows || rows.length < 2) {
        uploadStatusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Invalid file format';
        return;
      }
      
      const newData = [];
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        
        // Column mapping (0-indexed)
        // Column B (index 1) = Financial Year
        // Column C (index 2) = Office  
        // Column D (index 3) = Manager
        // Column F (index 5) = Customer
        // Column G (index 6) = Order Type
        // Column K (index 10) = Price
        
        const fyRaw = row[1];
        const office = row[2] ? String(row[2]).trim() : "Not Specified";
        const manager = row[3] ? String(row[3]).trim() : "Not Specified";
        const customer = row[5] ? String(row[5]).trim() : "Not Specified";
        const type = row[6] ? String(row[6]).trim() : "Standard";
        const priceRaw = row[10];
        
        let fy;
        if (!fyRaw || String(fyRaw).trim() === "") {
          fy = "Unknown FY";
        } else {
          fy = formatFY(fyRaw);
        }
        
        let price = 0;
        if (priceRaw !== undefined && priceRaw !== "") {
          const parsedPrice = parseFloat(priceRaw);
          if (!isNaN(parsedPrice) && parsedPrice > 0) {
            price = parsedPrice;
          }
        }
        
        newData.push({ 
          fy: fy,
          office: office,
          manager: manager,
          customer: customer,
          type: type,
          price: price
        });
      }
      
      rawData = newData;
      const totalEntries = rawData.length;
      
      selectedYearsSet.clear();
      getAllYears().forEach(y => selectedYearsSet.add(y));
      rebuildYearFilterUI();
      
      uploadStatusDiv.innerHTML = `<i class="fas fa-check-circle" style="color:#34d399;"></i> ✓ Loaded ${totalEntries} entries (all rows processed)`;
      
      setTimeout(() => {
        if (uploadStatusDiv) uploadStatusDiv.innerHTML = `<i class="fas fa-chart-line"></i> ${totalEntries} total entries • ${getAllYears().length} financial years`;
      }, 3000);
      
      refreshAll();
      clearCustomerSearch();
      
    } catch (error) {
      console.error('Error parsing file:', error);
      uploadStatusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error parsing file';
    }
  };
  
  reader.onerror = function() {
    uploadStatusDiv.innerHTML = '<i class="fas fa-bug"></i> Error reading file';
  };
  
  reader.readAsArrayBuffer(file);
}

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) {
    const file = e.target.files[0];
    uploadStatusDiv.innerHTML = `<i class="fas fa-spinner fa-pulse"></i> Loading ${file.name}...`;
    handleExcelUpload(file);
  }
});

// Customer Search Function - Search in Column F (Customer)
function searchCustomer() {
  const searchTerm = customerSearchInput.value.trim();
  if (!searchTerm) {
    searchResultInfo.innerHTML = '<i class="fas fa-info-circle"></i> Please enter a customer name to search';
    return;
  }
  
  const filteredData = getFilteredData();
  if (!filteredData.length) {
    searchResultInfo.innerHTML = '<i class="fas fa-exclamation-triangle"></i> No data available. Please upload an Excel file first.';
    return;
  }
  
  // Case-insensitive search in Column F (customer field)
  const customerData = filteredData.filter(d => 
    d.customer.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (customerData.length === 0) {
    searchResultInfo.innerHTML = `<i class="fas fa-search"></i> No customer found matching "${searchTerm}" in Column F`;
    customerChartContainer.style.display = 'none';
    clearSearchBtn.style.display = 'none';
    return;
  }
  
  // Group by financial year (Column B)
  const yearlyData = new Map();
  customerData.forEach(d => {
    const year = d.fy;
    yearlyData.set(year, (yearlyData.get(year) || 0) + d.price);
  });
  
  // Sort by year
  const sortedYears = Array.from(yearlyData.keys()).sort();
  const labels = sortedYears;
  const data = sortedYears.map(year => yearlyData.get(year));
  
  const totalValue = data.reduce((sum, val) => sum + val, 0);
  const avgValue = totalValue / customerData.length;
  const orderCount = customerData.length;
  
  // Display result info
  searchResultInfo.innerHTML = `<i class="fas fa-check-circle" style="color:#34d399;"></i> Found ${orderCount} order(s) for "${searchTerm}" across ${labels.length} financial year(s)`;
  clearSearchBtn.style.display = 'flex';
  customerChartContainer.style.display = 'block';
  
  // Update chart title
  customerChartTitle.innerHTML = `<i class="fas fa-chart-bar"></i> ${searchTerm} - Year-wise PO Value (Financial Year vs Total Amount)`;
  
  // Render customer yearly chart
  renderCustomerYearlyChart(labels, data, searchTerm);
  
  // Display stats
  customerStats.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total PO Value (Column K)</div>
      <div class="stat-value">₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Orders</div>
      <div class="stat-value">${orderCount}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Average Order Value</div>
      <div class="stat-value">₹${avgValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Financial Years</div>
      <div class="stat-value">${labels.length}</div>
    </div>
  `;
}

function renderCustomerYearlyChart(labels, data, customerName) {
  const canvas = document.getElementById('customerYearlyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (customerYearlyChart) customerYearlyChart.destroy();
  
  if (!labels.length) {
    customerYearlyChart = new Chart(ctx, {
      type: 'bar',
      data: { labels: ['No Data'], datasets: [{ data: [0], backgroundColor: '#475569' }] },
      options: { responsive: true }
    });
    return;
  }
  
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, '#fbbf24');
  gradient.addColorStop(1, '#f59e0b');
  
  customerYearlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Total PO Value (₹) - Column K',
        data: data,
        backgroundColor: gradient,
        borderRadius: 12,
        barPercentage: 0.7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => ` Total Amount: ₹ ${ctx.raw.toLocaleString('en-IN')}`
          }
        },
        legend: {
          labels: { color: '#e2e8f0', font: { size: 12 } }
        }
      },
      scales: {
        x: {
          ticks: { color: '#cbd5e6', maxRotation: 45, font: { size: 11 } },
          grid: { color: 'rgba(139,92,246,0.15)' },
          title: { 
            display: true, 
            text: 'Financial Year (Column B)', 
            color: '#a78bfa',
            font: { weight: 'bold', size: 12 }
          }
        },
        y: {
          ticks: { color: '#cbd5e6', callback: (v) => '₹' + v.toLocaleString() },
          grid: { color: 'rgba(139,92,246,0.1)' },
          title: { 
            display: true, 
            text: 'Total PO Value (₹) - Column K', 
            color: '#c4b5fd',
            font: { weight: 'bold', size: 12 }
          }
        }
      }
    }
  });
}

function clearCustomerSearch() {
  customerSearchInput.value = '';
  searchResultInfo.innerHTML = '';
  customerChartContainer.style.display = 'none';
  clearSearchBtn.style.display = 'none';
  if (customerYearlyChart) {
    customerYearlyChart.destroy();
    customerYearlyChart = null;
  }
}

// KPI Calculation
function computeKPIs(filteredData) {
  if (!filteredData.length) {
    totalPOEl.innerText = '₹0';
    totalOrdersEl.innerText = '0';
    avgPOEl.innerText = '₹0';
    topCustomerEl.innerText = '—';
    topOfficeEl.innerText = '—';
    topManagerEl.innerText = '—';
    customerCountSpan.innerText = '0';
    return;
  }
  
  const totalValue = filteredData.reduce((s, d) => s + d.price, 0);
  const orderCount = filteredData.length;
  const avgValue = orderCount > 0 ? totalValue / orderCount : 0;
  
  const customerMap = new Map();
  const officeMap = new Map();
  const managerMap = new Map();
  const uniqueCustomers = new Set();
  
  filteredData.forEach(d => {
    uniqueCustomers.add(d.customer);
    customerMap.set(d.customer, (customerMap.get(d.customer) || 0) + d.price);
    officeMap.set(d.office, (officeMap.get(d.office) || 0) + d.price);
    managerMap.set(d.manager, (managerMap.get(d.manager) || 0) + d.price);
  });
  
  let topCust = '—', maxC = 0;
  let topOff = '—', maxOff = 0;
  let topMan = '—', maxMan = 0;
  
  for (let [k, v] of customerMap) if (v > maxC) { maxC = v; topCust = k; }
  for (let [k, v] of officeMap) if (v > maxOff) { maxOff = v; topOff = k; }
  for (let [k, v] of managerMap) if (v > maxMan) { maxMan = v; topMan = k; }
  
  totalPOEl.innerText = `₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  totalOrdersEl.innerText = orderCount.toLocaleString();
  avgPOEl.innerText = `₹${avgValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  topCustomerEl.innerText = topCust.length > 25 ? topCust.slice(0, 22) + '...' : topCust;
  topOfficeEl.innerText = topOff;
  topManagerEl.innerText = topMan;
  customerCountSpan.innerText = uniqueCustomers.size;
}

function getGroupedData(filteredData) {
  let groupKey = currentView === 'overview' ? 'fy' :
    currentView === 'office' ? 'office' :
      currentView === 'manager' ? 'manager' :
        currentView === 'customer' ? 'customer' : 'type';
  
  const agg = new Map();
  filteredData.forEach(d => {
    let key = d[groupKey] || 'N/A';
    if (!agg.has(key)) agg.set(key, { value: 0, count: 0 });
    const rec = agg.get(key);
    rec.value += d.price;
    rec.count += 1;
  });
  
  let entries = Array.from(agg.entries());
  if (currentMetric === 'value') entries.sort((a, b) => b[1].value - a[1].value);
  else entries.sort((a, b) => b[1].count - a[1].count);
  
  const labels = entries.map(e => e[0]).slice(0, 14);
  const data = entries.map(e => currentMetric === 'value' ? e[1].value : e[1].count).slice(0, 14);
  return { labels, data };
}

function renderMainChart(filteredData) {
  const canvas = document.getElementById('masterChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (chartInstance) chartInstance.destroy();
  
  if (!filteredData.length) {
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: { 
        labels: ['No Data'], 
        datasets: [{ 
          label: 'No records available', 
          data: [0], 
          backgroundColor: '#475569' 
        }] 
      },
      options: { 
        responsive: true,
        plugins: {
          legend: { labels: { color: '#e2e8f0' } }
        }
      }
    });
    return;
  }
  
  const { labels, data } = getGroupedData(filteredData);
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  if (currentMetric === 'value') {
    gradient.addColorStop(0, '#3b82f6');
    gradient.addColorStop(0.6, '#8b5cf6');
    gradient.addColorStop(1, '#ec489a');
  } else {
    gradient.addColorStop(0, '#10b981');
    gradient.addColorStop(1, '#34d399');
  }
  
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: currentMetric === 'value' ? 'Total PO Value (₹)' : 'Number of Orders',
        data,
        backgroundColor: gradient,
        borderRadius: 12,
        barPercentage: 0.7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => currentMetric === 'value' ? ` ₹ ${ctx.raw.toLocaleString('en-IN')}` : ` ${ctx.raw} orders`
          }
        },
        legend: { labels: { color: '#e2e8f0' } }
      },
      scales: {
        x: {
          ticks: { color: '#cbd5e6', maxRotation: 35 },
          grid: { color: 'rgba(139,92,246,0.15)' },
          title: { display: true, text: currentView === 'overview' ? 'Financial Year' : currentView, color: '#a78bfa' }
        },
        y: {
          ticks: { color: '#cbd5e6' },
          grid: { color: 'rgba(139,92,246,0.1)' },
          title: { display: true, text: currentMetric === 'value' ? 'Amount (₹)' : 'Order Count', color: '#c4b5fd' }
        }
      }
    }
  });
}

function renderTopCustomers(filteredData) {
  const canvas = document.getElementById('topCustomersChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (topCustomersChart) topCustomersChart.destroy();
  
  if (!filteredData.length) {
    topCustomersChart = new Chart(ctx, {
      type: 'bar',
      data: { labels: ['No Data'], datasets: [{ data: [0], backgroundColor: '#475569' }] },
      options: { responsive: true, plugins: { legend: { labels: { color: '#e2e8f0' } } } }
    });
    return;
  }
  
  const customerMap = new Map();
  filteredData.forEach(d => customerMap.set(d.customer, (customerMap.get(d.customer) || 0) + d.price));
  const sorted = Array.from(customerMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, '#fbbf24');
  gradient.addColorStop(1, '#f59e0b');
  
  topCustomersChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(s => s[0].length > 15 ? s[0].slice(0, 12) + '...' : s[0]),
      datasets: [{ 
        label: 'PO Value (₹)', 
        data: sorted.map(s => s[1]), 
        backgroundColor: gradient, 
        borderRadius: 8 
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'top', labels: { color: '#e2e8f0', font: { size: 10 } } },
        tooltip: { callbacks: { label: (ctx) => ` ₹ ${ctx.raw.toLocaleString('en-IN')}` } }
      },
      scales: {
        y: { ticks: { color: '#9ca3af', callback: v => '₹' + v.toLocaleString() } },
        x: { ticks: { color: '#cbd5e6', font: { size: 10 } } }
      }
    }
  });
}

function renderTopOffices(filteredData) {
  const canvas = document.getElementById('topOfficesChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (topOfficesChart) topOfficesChart.destroy();
  
  if (!filteredData.length) {
    topOfficesChart = new Chart(ctx, {
      type: 'bar',
      data: { labels: ['No Data'], datasets: [{ data: [0], backgroundColor: '#475569' }] },
      options: { responsive: true, plugins: { legend: { labels: { color: '#e2e8f0' } } } }
    });
    return;
  }
  
  const officeMap = new Map();
  filteredData.forEach(d => officeMap.set(d.office, (officeMap.get(d.office) || 0) + d.price));
  const sorted = Array.from(officeMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, '#60a5fa');
  gradient.addColorStop(1, '#3b82f6');
  
  topOfficesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(s => s[0]),
      datasets: [{ 
        label: 'PO Value (₹)', 
        data: sorted.map(s => s[1]), 
        backgroundColor: gradient, 
        borderRadius: 8 
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'top', labels: { color: '#e2e8f0', font: { size: 10 } } },
        tooltip: { callbacks: { label: (ctx) => ` ₹ ${ctx.raw.toLocaleString('en-IN')}` } }
      },
      scales: {
        y: { ticks: { color: '#9ca3af', callback: v => '₹' + v.toLocaleString() } },
        x: { ticks: { color: '#cbd5e6', font: { size: 10 } } }
      }
    }
  });
}

function renderOrderTypes(filteredData) {
  const canvas = document.getElementById('orderTypeChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (orderTypeChart) orderTypeChart.destroy();
  
  if (!filteredData.length) {
    orderTypeChart = new Chart(ctx, {
      type: 'pie',
      data: { labels: ['No Data'], datasets: [{ data: [1], backgroundColor: '#475569' }] },
      options: { responsive: true, plugins: { legend: { labels: { color: '#e2e8f0' } } } }
    });
    return;
  }
  
  const typeMap = new Map();
  filteredData.forEach(d => typeMap.set(d.type, (typeMap.get(d.type) || 0) + d.price));
  const colors = ['#3b82f6', '#8b5cf6', '#ec489a', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
  const entries = Array.from(typeMap.entries());
  
  orderTypeChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{ 
        data: entries.map(e => e[1]), 
        backgroundColor: colors.slice(0, entries.length), 
        borderWidth: 0 
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'right', labels: { color: '#e2e8f0', font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ₹${ctx.raw.toLocaleString('en-IN')}` } }
      }
    }
  });
}

// Main Refresh Function
function refreshAll() {
  const filteredData = getFilteredData();
  computeKPIs(filteredData);
  renderMainChart(filteredData);
  renderTopCustomers(filteredData);
  renderTopOffices(filteredData);
  renderOrderTypes(filteredData);
  clearCustomerSearch();
}

// View and Metric Setters
function setDashboardView(view) {
  currentView = view;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const btn = document.querySelector(`.tab-btn[data-view="${view}"]`);
  if (btn) btn.classList.add('active');
  refreshAll();
}

function setChartMetric(metric) {
  currentMetric = metric;
  document.querySelectorAll('.toggle-option').forEach(opt => opt.classList.remove('active-metric'));
  const opt = document.querySelector(`.toggle-option[data-metric="${metric}"]`);
  if (opt) opt.classList.add('active-metric');
  refreshAll();
}

// Attach event listeners
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => setDashboardView(btn.getAttribute('data-view')));
});

document.querySelectorAll('.toggle-option').forEach(opt => {
  opt.addEventListener('click', () => setChartMetric(opt.getAttribute('data-metric')));
});

searchCustomerBtn.addEventListener('click', searchCustomer);
clearSearchBtn.addEventListener('click', clearCustomerSearch);
customerSearchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchCustomer();
});

// Initialize empty state
refreshAll();