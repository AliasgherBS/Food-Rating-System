// Admin Dashboard JavaScript

// State Management
let currentTab = 'companies';
let companies = [];
let selectedCompanyId = null;

// Initialize Admin Dashboard
document.addEventListener('DOMContentLoaded', async function() {
    loadCompanies();
    await loadCompanySelects();
    
    // Set today's date as default for menu creation
    const today = new Date().toISOString().split('T')[0];
    const menuDateInput = document.getElementById('menu-date');
    if (menuDateInput) {
        menuDateInput.value = today;
    }
});

// Tab Management
async function showTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.remove('active'));
    
    // Hide all nav tabs
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
    
    currentTab = tabName;
    
    // Load data for the selected tab
    if (tabName === 'companies') {
        loadCompanies();
    } else if (tabName === 'menus') {
        await loadCompanySelects(); // Refresh dropdown first
        loadCompanyMenus();
    } else if (tabName === 'analytics') {
        await loadCompanySelects(); // Refresh dropdown first
        loadAnalytics();
    }
}

// Company Management
async function loadCompanies() {
    const companiesList = document.getElementById('companies-list');
    Loading.show('companies-list');
    
    try {
        companies = await Utils.fetchAPI('/companies');
        renderCompanies(companies);
    } catch (error) {
        companiesList.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load companies: ${error.message}</p>
                <button class="btn btn-primary" onclick="loadCompanies()">
                    <i class="fas fa-sync-alt"></i>
                    Retry
                </button>
            </div>
        `;
    }
}

function renderCompanies(companiesList) {
    const container = document.getElementById('companies-list');
    
    if (companiesList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-building"></i>
                <h3>No Companies Yet</h3>
                <p>Add your first company to get started with the rating system.</p>
                <button class="btn btn-primary" onclick="showAddCompanyModal()">
                    <i class="fas fa-plus"></i>
                    Add Company
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = companiesList.map(company => `
        <div class="company-item">
            <div class="company-header">
                <div>
                    <h3 class="company-title">${Utils.sanitizeInput(company.name)}</h3>
                    <span class="company-type-badge ${company.type}">
                        ${company.type === 'static' ? 'Static Menu' : 'Cafeteria'}
                    </span>
                </div>
            </div>
            <div class="company-meta">
                <i class="fas fa-calendar"></i>
                Created ${Utils.formatDate(company.created_at)}
            </div>
            <div class="company-actions">
                <button class="btn btn-sm btn-primary" onclick="editCompany('${company.id}')">
                    <i class="fas fa-edit"></i>
                    Edit
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteCompany('${company.id}', '${Utils.sanitizeInput(company.name)}')">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
            </div>
        </div>
    `).join('');
}

function showAddCompanyModal() {
    document.getElementById('add-company-form').reset();
    resetCompanyForm(); // Ensure form is in add mode
    Modal.show('add-company-modal');
}

async function addCompany(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Validate form
    const errors = Validator.validateForm(form);
    if (errors.length > 0) {
        Utils.showToast(errors[0], 'error');
        return;
    }
    
    const formData = new FormData(form);
    const companyData = {
        name: formData.get('company-name') || document.getElementById('company-name').value,
        type: formData.get('company-type') || document.getElementById('company-type').value
    };
    
    Loading.setButtonLoading(submitBtn, true);
    
    try {
        await Utils.fetchAPI('/companies', {
            method: 'POST',
            body: JSON.stringify(companyData)
        });
        
        Utils.showToast('Company added successfully!', 'success');
        Modal.hide('add-company-modal');
        await loadCompanies();
        await loadCompanySelects();
    } catch (error) {
        Utils.showToast(`Failed to add company: ${error.message}`, 'error');
    } finally {
        Loading.setButtonLoading(submitBtn, false);
    }
}

async function editCompany(companyId) {
    try {
        const company = await Utils.fetchAPI(`/companies/${companyId}`);
        
        // Populate form with existing data
        document.getElementById('company-name').value = company.name;
        document.getElementById('company-type').value = company.type;
        
        // Change form submission to update instead of create
        const form = document.getElementById('add-company-form');
        form.onsubmit = async (event) => {
            event.preventDefault();
            await updateCompany(companyId, event);
        };
        
        // Change modal title and button text
        document.querySelector('#add-company-modal .modal-header h3').textContent = 'Edit Company';
        document.querySelector('#add-company-modal button[type="submit"]').innerHTML = '<i class="fas fa-save"></i> Update Company';
        
        Modal.show('add-company-modal');
    } catch (error) {
        Utils.showToast(`Failed to load company: ${error.message}`, 'error');
    }
}

async function updateCompany(companyId, event) {
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    const formData = new FormData(form);
    const companyData = {
        name: formData.get('company-name') || document.getElementById('company-name').value,
        type: formData.get('company-type') || document.getElementById('company-type').value
    };
    
    Loading.setButtonLoading(submitBtn, true);
    
    try {
        await Utils.fetchAPI(`/companies/${companyId}`, {
            method: 'PUT',
            body: JSON.stringify(companyData)
        });
        
        Utils.showToast('Company updated successfully!', 'success');
        Modal.hide('add-company-modal');
        await loadCompanies();
        await loadCompanySelects();
        
        // Reset form for next use
        resetCompanyForm();
    } catch (error) {
        Utils.showToast(`Failed to update company: ${error.message}`, 'error');
    } finally {
        Loading.setButtonLoading(submitBtn, false);
    }
}

function resetCompanyForm() {
    const form = document.getElementById('add-company-form');
    form.onsubmit = addCompany;
    document.querySelector('#add-company-modal .modal-header h3').textContent = 'Add New Company';
    document.querySelector('#add-company-modal button[type="submit"]').innerHTML = '<i class="fas fa-plus"></i> Add Company';
}

async function deleteCompany(companyId, companyName) {
    if (!confirm(`Are you sure you want to delete "${companyName}"?\n\nThis will also delete:\n• All menus for this company\n• All employee ratings and submissions\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const result = await Utils.fetchAPI(`/companies/${companyId}`, {
            method: 'DELETE'
        });
        
        const counts = result.deleted_counts;
        const message = `Company deleted successfully!\n• Menus: ${counts.menus}\n• Submissions: ${counts.submissions}\n• Ratings: ${counts.ratings}`;
        
        Utils.showToast('Company and all associated data deleted successfully!', 'success');
        console.log(message); // Log details to console
        
        // Refresh all relevant data
        await loadCompanies();
        await loadCompanySelects();
    } catch (error) {
        Utils.showToast(`Failed to delete company: ${error.message}`, 'error');
    }
}

// Menu Management
async function loadCompanySelects() {
    const selects = [
        document.getElementById('menu-company-select'),
        document.getElementById('analytics-company-select')
    ];
    
    try {
        // Always fetch fresh data from database
        const freshCompanies = await Utils.fetchAPI('/companies');
        
        selects.forEach(select => {
            if (select) {
                const currentValue = select.value; // Preserve current selection
                select.innerHTML = '<option value="">Select Company</option>';
                freshCompanies.forEach(company => {
                    const option = document.createElement('option');
                    option.value = company.id;
                    option.textContent = company.name;
                    if (company.id === currentValue) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
                
                // If previously selected company no longer exists, clear selection
                if (currentValue && !freshCompanies.find(c => c.id === currentValue)) {
                    select.value = '';
                    // Clear dependent data
                    if (select.id === 'menu-company-select') {
                        document.getElementById('menus-list').innerHTML = `
                            <div class="empty-state">
                                <i class="fas fa-utensils"></i>
                                <p>Select a company to view and manage menus</p>
                            </div>
                        `;
                        document.getElementById('add-menu-btn').disabled = true;
                    } else if (select.id === 'analytics-company-select') {
                        document.getElementById('analytics-content').innerHTML = `
                            <div class="empty-state">
                                <i class="fas fa-chart-bar"></i>
                                <p>Select a company to view analytics</p>
                            </div>
                        `;
                    }
                }
            }
        });
    } catch (error) {
        console.error('Failed to load companies for dropdowns:', error);
        selects.forEach(select => {
            if (select) {
                select.innerHTML = '<option value="">Error loading companies</option>';
            }
        });
    }
}

async function loadCompanyMenus() {
    const companySelect = document.getElementById('menu-company-select');
    const selectedCompanyId = companySelect.value;
    const menusList = document.getElementById('menus-list');
    const addMenuBtn = document.getElementById('add-menu-btn');
    
    if (!selectedCompanyId) {
        menusList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-utensils"></i>
                <p>Select a company to view and manage menus</p>
            </div>
        `;
        addMenuBtn.disabled = true;
        return;
    }
    
    addMenuBtn.disabled = false;
    Loading.show('menus-list');
    
    try {
        const menus = await Utils.fetchAPI(`/menus/${selectedCompanyId}`);
        renderMenus(menus);
    } catch (error) {
        menusList.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load menus: ${error.message}</p>
                <button class="btn btn-primary" onclick="loadCompanyMenus()">
                    <i class="fas fa-sync-alt"></i>
                    Retry
                </button>
            </div>
        `;
    }
}

function renderMenus(menus) {
    const container = document.getElementById('menus-list');
    
    if (menus.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-utensils"></i>
                <h3>No Menus Yet</h3>
                <p>Add your first menu for this company.</p>
                <button class="btn btn-primary" onclick="showAddMenuModal()">
                    <i class="fas fa-plus"></i>
                    Add Menu
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = menus.map(menu => `
        <div class="menu-item">
            <div class="menu-header">
                <div class="menu-date">
                    <i class="fas fa-calendar"></i>
                    ${Utils.formatDate(menu.date)}
                </div>
                <div class="menu-actions">
                    <button class="btn btn-sm btn-outline" onclick="showAddItemsModal('${menu.id}')">
                        <i class="fas fa-plus"></i>
                        Add Items
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="editMenu('${menu.id}')">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteMenu('${menu.id}')">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
            <div class="menu-items-grid">
                ${menu.items.map(item => `
                    <div class="menu-item-card">
                        <div class="menu-item-content">
                        <div class="menu-item-name">${Utils.sanitizeInput(item.name)}</div>
                        ${item.description ? `<div class="menu-item-description">${Utils.sanitizeInput(item.description)}</div>` : ''}
                        </div>
                        <div class="menu-item-actions">
                            <button class="btn btn-xs btn-outline" onclick="editMenuItem('${menu.id}', '${item.id}', this)" title="Edit item">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-xs btn-danger" onclick="deleteMenuItem('${menu.id}', '${item.id}', this)" title="Delete item">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function showAddMenuModal() {
    const companySelect = document.getElementById('menu-company-select');
    selectedCompanyId = companySelect.value;
    
    if (!selectedCompanyId) {
        Utils.showToast('Please select a company first', 'warning');
        return;
    }
    
    document.getElementById('add-menu-form').reset();
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('menu-date').value = today;
    
    // Reset menu items container
    const container = document.getElementById('menu-items-container');
    container.innerHTML = `
        <div class="menu-item-input">
            <input type="text" placeholder="Item name" required>
            <input type="text" placeholder="Description (optional)">
            <button type="button" class="btn-remove" onclick="removeMenuItem(this)">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    // Update item count
    updateItemCount();
    
    Modal.show('add-menu-modal');
}

function addMenuItem() {
    addItemToContainer('menu-items-container');
}

function removeMenuItem(button) {
    const container = document.getElementById('menu-items-container');
    if (container.children.length > 1) {
        button.closest('.menu-item-input').remove();
        updateItemCount();
    } else {
        Utils.showToast('At least one menu item is required', 'warning');
    }
}

async function addMenu(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Collect menu items
    const menuItemInputs = document.querySelectorAll('.menu-item-input');
    const items = [];
    
    for (const itemInput of menuItemInputs) {
        const nameInput = itemInput.querySelector('input[placeholder="Item name"]');
        const descInput = itemInput.querySelector('input[placeholder="Description (optional)"]');
        
        if (nameInput.value.trim()) {
            items.push({
                name: nameInput.value.trim(),
                description: descInput.value.trim()
            });
        }
    }
    
    if (items.length === 0) {
        Utils.showToast('Please add at least one menu item', 'warning');
        return;
    }
    
    const menuData = {
        company_id: selectedCompanyId,
        date: document.getElementById('menu-date').value,
        items: items
    };
    
    Loading.setButtonLoading(submitBtn, true);
    
    try {
        await Utils.fetchAPI(`/menu/${selectedCompanyId}?replace=true`, {
            method: 'POST',
            body: JSON.stringify(menuData)
        });
        
        Utils.showToast('Menu added successfully!', 'success');
        Modal.hide('add-menu-modal');
        loadCompanyMenus();
    } catch (error) {
        Utils.showToast(`Failed to add menu: ${error.message}`, 'error');
    } finally {
        Loading.setButtonLoading(submitBtn, false);
    }
}

function addItemToContainer(containerId) {
    const container = document.getElementById(containerId);
    const newItem = document.createElement('div');
    newItem.className = 'menu-item-input';
    newItem.innerHTML = `
        <input type="text" placeholder="Item name" required>
        <input type="text" placeholder="Description (optional)">
        <button type="button" class="btn-remove" onclick="removeMenuItem(this)">
            <i class="fas fa-trash"></i>
        </button>
    `;
    container.appendChild(newItem);
    
    // Update item count if we're in the add menu modal
    updateItemCount();
}

function updateItemCount() {
    const container = document.getElementById('menu-items-container');
    const itemCount = document.querySelector('.item-count');
    
    if (container && itemCount) {
        const count = container.children.length;
        itemCount.textContent = `${count} item${count !== 1 ? 's' : ''}`;
    }
}

function updateEditItemCount() {
    const container = document.getElementById('edit-menu-items-container');
    const itemCount = document.querySelector('.edit-item-count');
    
    if (container && itemCount) {
        const visibleItems = Array.from(container.children).filter(item => 
            item.style.display !== 'none' && item.dataset.deleted !== 'true'
        );
        const count = visibleItems.length;
        itemCount.textContent = `${count} item${count !== 1 ? 's' : ''}`;
    }
}

function showAddItemsModal(menuId) {
    document.getElementById('target-menu-id').value = menuId;
    
    // Reset the container
    const container = document.getElementById('add-items-container');
    container.innerHTML = `
        <div class="menu-item-input">
            <input type="text" placeholder="Item name" required>
            <input type="text" placeholder="Description (optional)">
            <button type="button" class="btn-remove" onclick="removeMenuItem(this)">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    Modal.show('add-items-modal');
}

async function addItemsToMenu(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const menuId = document.getElementById('target-menu-id').value;
    
    // Collect menu items
    const menuItemInputs = document.querySelectorAll('#add-items-container .menu-item-input');
    const items = [];
    
    for (const itemInput of menuItemInputs) {
        const nameInput = itemInput.querySelector('input[placeholder="Item name"]');
        const descInput = itemInput.querySelector('input[placeholder="Description (optional)"]');
        
        if (nameInput.value.trim()) {
            items.push({
                name: nameInput.value.trim(),
                description: descInput.value.trim()
            });
        }
    }
    
    if (items.length === 0) {
        Utils.showToast('Please add at least one menu item', 'warning');
        return;
    }
    
    Loading.setButtonLoading(submitBtn, true);
    
    try {
        await Utils.fetchAPI(`/menu/${menuId}/items`, {
            method: 'POST',
            body: JSON.stringify(items)
        });
        
        Utils.showToast('Items added successfully!', 'success');
        Modal.hide('add-items-modal');
        loadCompanyMenus();
    } catch (error) {
        Utils.showToast(`Failed to add items: ${error.message}`, 'error');
    } finally {
        Loading.setButtonLoading(submitBtn, false);
    }
}

async function editMenu(menuId) {
    try {
        // Get the menu data first
        const companyId = document.getElementById('menu-company-select').value;
        const menus = await Utils.fetchAPI(`/menus/${companyId}`);
        const menu = menus.find(m => m.id === menuId);
        
        if (!menu) {
            Utils.showToast('Menu not found', 'error');
            return;
        }
        
        // Populate the edit form
        document.getElementById('edit-menu-id').value = menuId;
        document.getElementById('edit-menu-date').value = menu.date;
        
        const container = document.getElementById('edit-menu-items-container');
        container.innerHTML = menu.items.map(item => `
            <div class="menu-item-input" data-item-id="${item.id}">
                <input type="text" placeholder="Item name" value="${Utils.sanitizeInput(item.name)}" required>
                <input type="text" placeholder="Description (optional)" value="${Utils.sanitizeInput(item.description || '')}">
                <button type="button" class="btn-remove" onclick="removeEditMenuItem(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
        
        // Update item count
        updateEditItemCount();
        
        Modal.show('edit-menu-modal');
    } catch (error) {
        Utils.showToast(`Failed to load menu: ${error.message}`, 'error');
    }
}

function addEditMenuItem() {
    const container = document.getElementById('edit-menu-items-container');
    const newItem = document.createElement('div');
    newItem.className = 'menu-item-input';
    newItem.innerHTML = `
        <input type="text" placeholder="Item name" required>
        <input type="text" placeholder="Description (optional)">
        <button type="button" class="btn-remove" onclick="removeEditMenuItem(this)">
            <i class="fas fa-trash"></i>
        </button>
    `;
    container.appendChild(newItem);
    
    // Update item count
    updateEditItemCount();
}

function removeEditMenuItem(button) {
    const container = document.getElementById('edit-menu-items-container');
    const itemDiv = button.closest('.menu-item-input');
    const itemId = itemDiv.dataset.itemId;
    
    if (itemId) {
        // Mark for deletion instead of removing immediately
        itemDiv.style.display = 'none';
        itemDiv.dataset.deleted = 'true';
    } else {
        // New item, can be removed directly
        const visibleItems = Array.from(container.children).filter(item => 
            item.style.display !== 'none' && item.dataset.deleted !== 'true'
        );
        if (visibleItems.length > 1) {
            itemDiv.remove();
        } else {
            Utils.showToast('At least one menu item is required', 'warning');
        }
    }
    
    // Update item count
    updateEditItemCount();
}

async function updateMenu(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const menuId = document.getElementById('edit-menu-id').value;
    
    Loading.setButtonLoading(submitBtn, true);
    
    try {
        const container = document.getElementById('edit-menu-items-container');
        const itemInputs = container.querySelectorAll('.menu-item-input');
        
        // Process updates, deletions, and additions
        const promises = [];
        
        for (const itemInput of itemInputs) {
            const itemId = itemInput.dataset.itemId;
            const nameInput = itemInput.querySelector('input[placeholder="Item name"]');
            const descInput = itemInput.querySelector('input[placeholder="Description (optional)"]');
            
            if (itemInput.dataset.deleted === 'true' && itemId) {
                // Delete existing item
                promises.push(
                    Utils.fetchAPI(`/menu/${menuId}/items/${itemId}`, {
                        method: 'DELETE'
                    })
                );
            } else if (itemId) {
                // Update existing item
                const updateData = {
                    name: nameInput.value.trim(),
                    description: descInput.value.trim()
                };
                
                promises.push(
                    Utils.fetchAPI(`/menu/${menuId}/items/${itemId}`, {
                        method: 'PUT',
                        body: JSON.stringify(updateData)
                    })
                );
            } else if (nameInput.value.trim()) {
                // Add new item
                const newItem = {
                    name: nameInput.value.trim(),
                    description: descInput.value.trim()
                };
                
                promises.push(
                    Utils.fetchAPI(`/menu/${menuId}/items`, {
                        method: 'POST',
                        body: JSON.stringify([newItem])
                    })
                );
            }
        }
        
        await Promise.all(promises);
        
        Utils.showToast('Menu updated successfully!', 'success');
        Modal.hide('edit-menu-modal');
        loadCompanyMenus();
    } catch (error) {
        Utils.showToast(`Failed to update menu: ${error.message}`, 'error');
    } finally {
        Loading.setButtonLoading(submitBtn, false);
    }
}

async function editMenuItem(menuId, itemId, buttonElement) {
    // Get the item data from the card
    const itemCard = buttonElement.closest('.menu-item-card');
    const nameElement = itemCard.querySelector('.menu-item-name');
    const descElement = itemCard.querySelector('.menu-item-description');
    
    const currentName = nameElement.textContent;
    const currentDesc = descElement ? descElement.textContent : '';
    
    const newName = prompt('Edit item name:', currentName);
    if (newName === null) return; // User cancelled
    
    const newDescription = prompt('Edit item description:', currentDesc);
    if (newDescription === null) return; // User cancelled
    
    try {
        await Utils.fetchAPI(`/menu/${menuId}/items/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: newName.trim(),
                description: newDescription.trim()
            })
        });
        
        Utils.showToast('Menu item updated successfully!', 'success');
        loadCompanyMenus();
    } catch (error) {
        Utils.showToast(`Failed to update item: ${error.message}`, 'error');
    }
}

async function deleteMenuItem(menuId, itemId, buttonElement) {
    // Get the item name from the card
    const itemCard = buttonElement.closest('.menu-item-card');
    const nameElement = itemCard.querySelector('.menu-item-name');
    const itemName = nameElement.textContent;
    
    if (!confirm(`Are you sure you want to delete "${itemName}"?`)) {
        return;
    }
    
    try {
        await Utils.fetchAPI(`/menu/${menuId}/items/${itemId}`, {
            method: 'DELETE'
        });
        
        Utils.showToast('Menu item deleted successfully!', 'success');
        loadCompanyMenus();
    } catch (error) {
        Utils.showToast(`Failed to delete item: ${error.message}`, 'error');
    }
}

async function deleteMenu(menuId) {
    if (!confirm('Are you sure you want to delete this menu? This will also delete all associated ratings and cannot be undone.')) {
        return;
    }
    
    try {
        const result = await Utils.fetchAPI(`/menu/${menuId}`, {
            method: 'DELETE'
        });
        
        const counts = result.deleted_counts;
        const message = `Menu deleted successfully!\n• Date: ${result.date}\n• Ratings deleted: ${counts.ratings}`;
        
        Utils.showToast('Menu deleted successfully!', 'success');
        console.log(message); // Log details to console
        
        // Refresh menus
        await loadCompanyMenus();
    } catch (error) {
        Utils.showToast(`Failed to delete menu: ${error.message}`, 'error');
    }
}

// Analytics
async function loadAnalytics() {
    const companySelect = document.getElementById('analytics-company-select');
    const periodSelect = document.getElementById('analytics-period-select');
    const selectedCompanyId = companySelect.value;
    const selectedPeriod = periodSelect.value;
    const analyticsContent = document.getElementById('analytics-content');
    
    if (!selectedCompanyId) {
        analyticsContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-bar"></i>
                <p>Select a company to view analytics</p>
            </div>
        `;
        return;
    }
    
    Loading.show('analytics-content');
    
    try {
        const analytics = await Utils.fetchAPI(`/analytics/${selectedCompanyId}?period=${selectedPeriod}`);
        renderAnalytics(analytics);
    } catch (error) {
        analyticsContent.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load analytics: ${error.message}</p>
                <button class="btn btn-primary" onclick="loadAnalytics()">
                    <i class="fas fa-sync-alt"></i>
                    Retry
                </button>
            </div>
        `;
    }
}

function renderAnalytics(analytics) {
    const container = document.getElementById('analytics-content');
    
    if (analytics.total_submissions === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-bar"></i>
                <h3>No Data Available</h3>
                <p>No ratings have been submitted for the selected period.</p>
            </div>
        `;
        return;
    }
    
    const ratingClass = Utils.getRatingText(analytics.average_rating).toLowerCase();
    const bestDish = analytics.best_dish;
    const worstDish = analytics.worst_dish;
    
    container.innerHTML = `
        <div class="analytics-overview">
            <div class="metric-card">
                <div class="metric-icon submissions">
                    <i class="fas fa-users"></i>
                </div>
                <div class="metric-value">${analytics.total_submissions}</div>
                <div class="metric-label">Submissions</div>
                <div class="metric-subtitle">${analytics.date_range}</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-icon rating">
                    <i class="fas fa-star"></i>
                </div>
                <div class="metric-value">${Utils.formatRating(analytics.average_rating)}</div>
                <div class="metric-label">Average Rating</div>
                <div class="metric-subtitle">${Utils.getRatingText(analytics.average_rating)}</div>
            </div>
            
            ${bestDish ? `
            <div class="metric-card">
                <div class="metric-icon best">
                    <i class="fas fa-trophy"></i>
                </div>
                <div class="metric-value">${Utils.formatRating(bestDish.average_rating)}</div>
                <div class="metric-label">Best Dish</div>
                <div class="metric-subtitle">${Utils.sanitizeInput(bestDish.item_name)}</div>
            </div>
            ` : ''}
            
            ${worstDish && bestDish && worstDish.item_name !== bestDish.item_name ? `
            <div class="metric-card">
                <div class="metric-icon worst">
                    <i class="fas fa-thumbs-down"></i>
                </div>
                <div class="metric-value">${Utils.formatRating(worstDish.average_rating)}</div>
                <div class="metric-label">Needs Improvement</div>
                <div class="metric-subtitle">${Utils.sanitizeInput(worstDish.item_name)}</div>
            </div>
            ` : ''}
        </div>
        
        ${analytics.item_ratings.length > 0 ? `
        <div class="ratings-table">
            <div class="table-header">
                <h3>
                    <i class="fas fa-utensils"></i>
                    Item Performance
                </h3>
            </div>
            <div class="table-content">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Average Rating</th>
                            <th>Total Ratings</th>
                            <th>Performance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analytics.item_ratings.map(item => `
                            <tr>
                                <td>${Utils.sanitizeInput(item.item_name)}</td>
                                <td>${Utils.formatRating(item.average_rating)}</td>
                                <td>${item.total_ratings}</td>
                                <td>
                                    <span class="rating-badge ${Utils.getRatingText(item.average_rating).toLowerCase()}">
                                        <i class="fas fa-star"></i>
                                        ${Utils.getRatingText(item.average_rating)}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : ''}
    `;
} 