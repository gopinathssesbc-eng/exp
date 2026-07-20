// REPLACE THIS URL WITH YOUR GOOGLE APPS SCRIPT WEB APP URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyTMJB4KovW1nLcB0S5d_7BZUmXnm28o8Iw_VlVivf--RJygFESnpvyG4-JFgzzBC3E/exec";

// State
let expenses = [];
let userPin = "";
let chartInstance = null;
let trendChartInstance = null;

// DOM Elements
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
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
            <div class="recent-item-amount text-danger">
                -${formatCurrency(parseFloat(exp.Amount) || 0)}
            </div>
        `;
        recentExpensesList.appendChild(div);
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
            }
        }
    });
};

// Modal Logic
fabAdd.addEventListener('click', () => {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    expDateInput.value = today;
    
    addModal.classList.add('show');
});

closeModalBtn.addEventListener('click', () => {
    addModal.classList.remove('show');
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
        date: date,
        amount: parseFloat(amount),
        paidFrom: account,
        category: category,
        description: desc
    };
    
    showLoading("Adding Expense...");
    addModal.classList.remove('show');
    
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (result.status === "error") {
            alert("Error adding expense: " + (result.error || "Unknown error"));
        } else {
            // Append locally and update UI so we don't need a full refetch immediately
            expenses.push({
                'Date': date,
                'Amount': amount,
                'Paid From': account,
                'Category': category,
                'Description': desc
            });
            updateDashboard();
            addExpenseForm.reset();
        }
    } catch (error) {
        console.error("Error submitting expense:", error);
        alert("Failed to submit expense. Network error.");
    } finally {
        hideLoading();
    }
});
