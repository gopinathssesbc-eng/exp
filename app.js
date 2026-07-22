// REPLACE THIS URL WITH YOUR GOOGLE APPS SCRIPT WEB APP URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyTMJB4KovW1nLcB0S5d_7BZUmXnm28o8Iw_VlVivf--RJygFESnpvyG4-JFgzzBC3E/exec";

// State
let expenses = [];
let userPin = "";
let editingRowIndex = null;
let chartInstance = null;
let trendChartInstance = null;
let breakdownChartInstance = null;

// DOM Elements
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const breakdownModal = document.getElementById('breakdown-modal');
const closeBreakdownBtn = document.getElementById('close-breakdown-btn');
const breakdownMonthTitle = document.getElementById('breakdown-month-title');
const breakdownChartCanvas = document.getElementById('breakdown-chart');
const breakdownList = document.getElementById('breakdown-list');
const pinInput = document.getElementById('pin-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

const monthlyTotalEl = document.getElementById('monthly-total');
const yearlyTotalEl = document.getElementById('yearly-total');
const recentExpensesList = document.getElementById('recent-expenses-list');
const categoryChartCanvas = document.getElementById('category-chart');
const trendChartCanvas = document.getElementById('trend-chart');

const fabAdd = document.getElementById('fab-add');
const addModal = document.getElementById('add-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const addExpenseForm = document.getElementById('add-expense-form');
const expDateInput = document.getElementById('exp-date');

const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');

const successModal = document.getElementById('success-modal');
const closeSuccessBtn = document.getElementById('close-success-btn');

// Format Currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
};

// Show/Hide Loading
const showLoading = (text = "Loading...") => {
    loadingText.innerText = text;
    loadingOverlay.classList.remove('hidden');
};

const hideLoading = () => {
    loadingOverlay.classList.add('hidden');
};

// Login Logic
loginBtn.addEventListener('click', async () => {
    const pin = pinInput.value;
    if (pin.length !== 4) {
        loginError.innerText = "Please enter a 4-digit PIN.";
        return;
    }
    
    loginError.innerText = "";
    showLoading("Authenticating...");
    
    try {
        // Send a GET request to check PIN and fetch initial data
        const response = await fetch(`${SCRIPT_URL}?pin=${pin}`);
        const result = await response.json();
        
        if (result.status === "error") {
            loginError.innerText = result.error || "Authentication failed.";
            hideLoading();
            return;
        }
        
        // Success
        userPin = pin;
        expenses = result.data || [];
        
        loginView.classList.remove('active-view');
        dashboardView.classList.add('active-view');
        
        updateDashboard();
        hideLoading();
        
    } catch (error) {
        console.error("Login Error:", error);
        loginError.innerText = "Network error. Make sure the Web App URL is correct and deployed.";
        hideLoading();
    }
});

// Logout Logic
logoutBtn.addEventListener('click', () => {
    userPin = "";
    expenses = [];
    pinInput.value = "";
    dashboardView.classList.remove('active-view');
    loginView.classList.add('active-view');
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
    if (trendChartInstance) {
        trendChartInstance.destroy();
        trendChartInstance = null;
    }
});

// Update Dashboard
const updateDashboard = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let monthlyTotal = 0;
    let yearlyTotal = 0;
    const categoryTotals = {};
    const recent = [];

    expenses.forEach(exp => {
        // Parse date
        const expDate = new Date(exp.Date);
        const amount = parseFloat(exp.Amount) || 0;
        
        if (isNaN(expDate.getTime())) return; // Skip invalid dates
        
        if (expDate.getFullYear() === currentYear) {
            yearlyTotal += amount;
            
            if (expDate.getMonth() === currentMonth) {
                monthlyTotal += amount;
                
                // For pie chart
                const cat = exp.Category || "Other";
                categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
            }
        }
    });
    
    monthlyTotalEl.innerText = formatCurrency(monthlyTotal);
    yearlyTotalEl.innerText = formatCurrency(yearlyTotal);
    
    updateChart(categoryTotals);
    updateTrendChart();
    updateRecentList();
};

const updateRecentList = () => {
    recentExpensesList.innerHTML = "";
    // Get last 5 expenses
    const recent = [...expenses].reverse().slice(0, 5);
    
    if (recent.length === 0) {
        recentExpensesList.innerHTML = "<p class='text-muted'>No recent expenses.</p>";
        return;
    }
    
    recent.forEach(exp => {
        const div = document.createElement('div');
        div.className = 'recent-item';
        
        const dateStr = new Date(exp.Date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        
        div.innerHTML = `
            <div class="recent-item-info">
                <h4>${exp.Description || exp.Category}</h4>
                <p>${dateStr} • ${exp.Category} • ${exp['Paid From']}</p>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div class="recent-item-amount text-danger">
                    -${formatCurrency(parseFloat(exp.Amount) || 0)}
                </div>
                <button class="icon-btn edit-btn" data-row="${exp.row}" title="Edit Expense">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="icon-btn delete-btn" data-row="${exp.row}" title="Delete Expense">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        `;
        recentExpensesList.appendChild(div);
    });

    // Add event listeners to edit buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.currentTarget.getAttribute('data-row');
            const exp = expenses.find(e => e.row == row);
            if (exp) {
                editingRowIndex = row;
                document.querySelector('#add-modal h2').innerText = 'Edit Expense';
                document.getElementById('update-btn').innerText = 'Update';
                
                // Format date to YYYY-MM-DD
                let formattedDate = "";
                if (exp.Date) {
                    const d = new Date(exp.Date);
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    formattedDate = `${yyyy}-${mm}-${dd}`;
                }
                
                document.getElementById('exp-date').value = formattedDate;
                document.getElementById('exp-amount').value = exp.Amount;
                document.getElementById('exp-account').value = exp['Paid From'];
                document.getElementById('exp-category').value = exp.Category;
                document.getElementById('exp-desc').value = exp.Description;
                
                addModal.classList.add('show');
                document.body.style.overflow = 'hidden';
            }
        });
    });

    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const row = e.currentTarget.getAttribute('data-row');
            if (confirm("Are you sure you want to delete this expense?")) {
                showLoading("Deleting Expense...");
                try {
                    const response = await fetch(SCRIPT_URL, {
                        method: 'POST',
                        body: JSON.stringify({ pin: userPin, action: 'delete', row: parseInt(row) })
                    });
                    const result = await response.json();
                    if (result.status === "error") {
                        alert("Error deleting expense: " + (result.error || "Unknown error"));
                    } else {
                        expenses = expenses.filter(exp => exp.row != row);
                        updateDashboard();
                    }
                } catch (error) {
                    console.error("Error deleting expense:", error);
                    alert("Failed to delete expense. Network error.");
                } finally {
                    hideLoading();
                }
            }
        });
    });
};

const updateChart = (categoryTotals) => {
    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    
    // Nice color palette for dark mode
    const colors = [
        '#6366f1', '#ef4444', '#10b981', '#f59e0b', '#3b82f6',
        '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e'
    ];
    
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    chartInstance = new Chart(categoryChartCanvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        padding: 20,
                        font: { family: 'Inter' }
                    }
                }
            },
            cutout: '70%'
        }
    });
};

const updateTrendChart = () => {
    // Generate last 6 months labels
    const labels = [];
    const monthlyData = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }));
        monthlyData.push({ month: d.getMonth(), year: d.getFullYear(), total: 0 });
    }
    
    // Sum up expenses
    expenses.forEach(exp => {
        const expDate = new Date(exp.Date);
        if (isNaN(expDate.getTime())) return;
        
        const amount = parseFloat(exp.Amount) || 0;
        const eMonth = expDate.getMonth();
        const eYear = expDate.getFullYear();
        
        // Find if this matches one of our 6 months
        const target = monthlyData.find(m => m.month === eMonth && m.year === eYear);
        if (target) {
            target.total += amount;
        }
    });
    
    const data = monthlyData.map(m => m.total);
    
    if (trendChartInstance) {
        trendChartInstance.destroy();
    }
    
    trendChartInstance = new Chart(trendChartCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: 'Trend',
                    data: data,
                    borderColor: '#10b981',
                    backgroundColor: '#10b981',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false
                },
                {
                    type: 'bar',
                    label: 'Expenses',
                    data: data,
                    backgroundColor: 'rgba(99, 102, 241, 0.7)',
                    borderColor: '#6366f1',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#94a3b8'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#94a3b8'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#94a3b8', font: { family: 'Inter' } }
                }
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    const targetMonth = monthlyData[idx];
                    showMonthBreakdown(targetMonth.month, targetMonth.year, labels[idx]);
                }
            }
        },
        plugins: [{
            id: 'barTotal',
            afterDatasetsDraw: (chart, args, pluginOptions) => {
                const { ctx } = chart;
                ctx.save();
                ctx.font = '600 11px Inter, sans-serif';
                ctx.fillStyle = '#f8fafc';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                chart.data.datasets.forEach((dataset, i) => {
                    if (dataset.type === 'bar') {
                        const meta = chart.getDatasetMeta(i);
                        meta.data.forEach((bar, index) => {
                            const value = dataset.data[index];
                            if (value > 0) {
                                ctx.fillText(value, bar.x, bar.y - 5);
                            }
                        });
                    }
                });
                ctx.restore();
            }
        }]
    });
};

const showMonthBreakdown = (month, year, label) => {
    breakdownMonthTitle.innerText = `${label} - Paid From`;
    
    const accountTotals = {};
    let totalForMonth = 0;
    
    expenses.forEach(exp => {
        const expDate = new Date(exp.Date);
        if (isNaN(expDate.getTime())) return;
        
        if (expDate.getMonth() === month && expDate.getFullYear() === year) {
            const amount = parseFloat(exp.Amount) || 0;
            const account = exp['Paid From'] || 'Unknown';
            accountTotals[account] = (accountTotals[account] || 0) + amount;
            totalForMonth += amount;
        }
    });
    
    const sortedAccounts = Object.entries(accountTotals).sort((a, b) => b[1] - a[1]);
    
    const colors = [
        '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6',
        '#8b5cf6', '#14b8a6', '#f43f5e', '#ef4444'
    ];
    
    if (breakdownChartInstance) {
        breakdownChartInstance.destroy();
    }
    
    breakdownChartInstance = new Chart(breakdownChartCanvas, {
        type: 'doughnut',
        data: {
            labels: sortedAccounts.map(a => a[0]),
            datasets: [{
                data: sortedAccounts.map(a => a[1]),
                backgroundColor: colors.slice(0, sortedAccounts.length),
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#94a3b8', font: { family: 'Inter' } }
                }
            },
            cutout: '70%'
        }
    });
    
    breakdownList.innerHTML = "";
    if (sortedAccounts.length === 0) {
        breakdownList.innerHTML = "<p class='text-muted' style='text-align: center;'>No expenses for this month.</p>";
    } else {
        sortedAccounts.forEach(([account, amount]) => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.padding = '0.75rem 0';
            div.style.borderBottom = '1px solid var(--card-border)';
            
            const percent = ((amount / totalForMonth) * 100).toFixed(1);
            
            div.innerHTML = `
                <div>
                    <h4 style="margin: 0; font-size: 0.95rem;">${account}</h4>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${percent}%</span>
                </div>
                <div style="font-weight: 600;">${formatCurrency(amount)}</div>
            `;
            breakdownList.appendChild(div);
        });
        if (breakdownList.lastChild) {
            breakdownList.lastChild.style.borderBottom = 'none';
        }
    }
    
    breakdownModal.classList.add('show');
    document.body.style.overflow = 'hidden';
};

// Modal Logic
fabAdd.addEventListener('click', () => {
    editingRowIndex = null;
    document.querySelector('#add-modal h2').innerText = 'Add Expense';
    document.getElementById('update-btn').innerText = 'Add';
    
    addExpenseForm.reset();
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    expDateInput.value = today;
    
    addModal.classList.add('show');
    document.body.style.overflow = 'hidden';
});

closeModalBtn.addEventListener('click', () => {
    addModal.classList.remove('show');
    document.body.style.overflow = '';
});

closeSuccessBtn.addEventListener('click', () => {
    successModal.classList.remove('show');
    document.body.style.overflow = '';
});

closeBreakdownBtn.addEventListener('click', () => {
    breakdownModal.classList.remove('show');
    document.body.style.overflow = '';
});

// Form Submission
addExpenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const date = document.getElementById('exp-date').value;
    const amount = document.getElementById('exp-amount').value;
    const account = document.getElementById('exp-account').value;
    const category = document.getElementById('exp-category').value;
    const desc = document.getElementById('exp-desc').value;
    
    const payload = {
        pin: userPin,
        action: editingRowIndex ? 'edit' : 'add',
        row: editingRowIndex,
        date: date,
        amount: parseFloat(amount),
        paidFrom: account,
        category: category,
        description: desc
    };
    
    showLoading(editingRowIndex ? "Updating Expense..." : "Adding Expense...");
    addModal.classList.remove('show');
    document.body.style.overflow = '';
    
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (result.status === "error") {
            alert("Error saving expense: " + (result.error || "Unknown error"));
        } else {
            // Update locally and update UI so we don't need a full refetch immediately
            if (editingRowIndex) {
                const expIndex = expenses.findIndex(e => e.row == editingRowIndex);
                if (expIndex !== -1) {
                    expenses[expIndex] = {
                        ...expenses[expIndex],
                        'Date': date,
                        'Amount': amount,
                        'Paid From': account,
                        'Category': category,
                        'Description': desc
                    };
                }
            } else {
                let nextRow = 2;
                if (expenses.length > 0) {
                    nextRow = Math.max(...expenses.map(e => e.row || 0)) + 1;
                }
                expenses.push({
                    'row': nextRow,
                    'Date': date,
                    'Amount': amount,
                    'Paid From': account,
                    'Category': category,
                    'Description': desc
                });
            }
            
            updateDashboard();
            addExpenseForm.reset();
            
            document.querySelector('#success-modal h2').innerText = editingRowIndex ? 'Update Successful' : 'Add Successful';
            document.querySelector('#success-modal p').innerText = editingRowIndex ? 'Your expense has been updated.' : 'Your expense has been added.';
            
            successModal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    } catch (error) {
        console.error("Error submitting expense:", error);
        alert("Failed to submit expense. Network error.");
    } finally {
        hideLoading();
    }
});
