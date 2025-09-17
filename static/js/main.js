// Main JavaScript utilities and common functions

// API Base URL
const API_BASE = '/api';

// Utility Functions
class Utils {
    static async fetchAPI(endpoint, options = {}) {
        try {
             const response = await fetch(`${API_BASE}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                credentials: 'include', // Include cookies for authentication
                ...options
            });

            if (!response.ok) {
                // If unauthorized, redirect to login
                if (response.status === 401) {
                    window.location.href = '/admin/login';
                    return;
                }
                
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    static formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    static formatRating(rating) {
        return parseFloat(rating).toFixed(1);
    }

    static getRatingColor(rating) {
        if (rating >= 4.5) return '#10b981'; // Green
        if (rating >= 3.5) return '#3b82f6'; // Blue
        if (rating >= 2.5) return '#f59e0b'; // Yellow
        return '#ef4444'; // Red
    }

    static getRatingText(rating) {
        if (rating >= 4.5) return 'Excellent';
        if (rating >= 3.5) return 'Good';
        if (rating >= 2.5) return 'Average';
        return 'Poor';
    }

    static showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${this.getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        // Add to page
        document.body.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Remove toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    static getToastIcon(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static generateId() {
        return Math.random().toString(36).substrk8(2, 9);
    }

    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    static sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    static copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Copied to clipboard!', 'success');
        }).catch(() => {
            this.showToast('Failed to copy to clipboard', 'error');
        });
    }
}

// Modal Management
class Modal {
    static show(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    static hide(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    static hideAll() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
}

// Loading States
class Loading {
    static show(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    Loading...
                </div>
            `;
        }
    }

    static hide(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            const loading = element.querySelector('.loading');
            if (loading) {
                loading.remove();
            }
        }
    }

    static setButtonLoading(buttonElement, isLoading = true) {
        if (isLoading) {
            buttonElement.originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            buttonElement.disabled = true;
        } else {
            buttonElement.innerHTML = buttonElement.originalHTML || buttonElement.innerHTML;
            buttonElement.disabled = false;
        }
    }
}

// Form Validation
class Validator {
    static validateForm(formElement) {
        const errors = [];
        const inputs = formElement.querySelectorAll('input[required], select[required], textarea[required]');
        
        inputs.forEach(input => {
            if (!input.value.trim()) {
                errors.push(`${this.getFieldLabel(input)} is required`);
                input.classList.add('error');
            } else {
                input.classList.remove('error');
            }

            // Email validation
            if (input.type === 'email' && input.value && !Utils.validateEmail(input.value)) {
                errors.push('Please enter a valid email address');
                input.classList.add('error');
            }
        });

        return errors;
    }

    static getFieldLabel(input) {
        const label = input.closest('.form-group')?.querySelector('label');
        return label?.textContent || input.placeholder || input.name || 'Field';
    }

    static clearErrors(formElement) {
        const inputs = formElement.querySelectorAll('.error');
        inputs.forEach(input => input.classList.remove('error'));
    }
}

// Global Functions
window.closeModal = function(modalId) {
    Modal.hide(modalId);
};

window.showModal = function(modalId) {
    Modal.show(modalId);
};

// Close modals when clicking outside
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        Modal.hide(e.target.id);
    }
});

// Close modals with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        Modal.hideAll();
    }
});

// Add form validation styles
const style = document.createElement('style');
style.textContent = `
    .error {
        border-color: #ef4444 !important;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
    }

    .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: white;
        border-radius: 0.5rem;
        padding: 1rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        transform: translateX(400px);
        transition: transform 0.3s ease;
        max-width: 400px;
    }

    .toast.show {
        transform: translateX(0);
    }

    .toast-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .toast-success {
        border-left: 4px solid #10b981;
    }

    .toast-error {
        border-left: 4px solid #ef4444;
    }

    .toast-warning {
        border-left: 4px solid #f59e0b;
    }

    .toast-info {
        border-left: 4px solid #3b82f6;
    }

    .toast-success .fas {
        color: #10b981;
    }

    .toast-error .fas {
        color: #ef4444;
    }

    .toast-warning .fas {
        color: #f59e0b;
    }

    .toast-info .fas {
        color: #3b82f6;
    }
`;
document.head.appendChild(style);

// Export for other modules
window.Utils = Utils;
window.Modal = Modal;
window.Loading = Loading;
window.Validator = Validator; 