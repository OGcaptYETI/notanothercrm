/**
 * Admin Notifications
 * Simple notification system for the admin dashboard
 */

class AdminNotifications {
    constructor() {
        this.container = null;
        this.timeout = null;
        this.init();
    }
    
    /**
     * Initialize the notification system
     */
    init() {
        // Create notification container if it doesn't exist
        if (!document.getElementById('admin-notifications')) {
            this.container = document.createElement('div');
            this.container.id = 'admin-notifications';
            this.container.className = 'admin-notifications';
            document.body.appendChild(this.container);
            
            // Add styles
            this.addStyles();
        } else {
            this.container = document.getElementById('admin-notifications');
        }
    }
    
    /**
     * Add notification styles to the page
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .admin-notifications {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 400px;
            }
            
            .admin-notification {
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: center;
                justify-content: space-between;
                animation: slideIn 0.3s ease-out forwards;
                color: #fff;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
            }
            
            .admin-notification.success {
                background-color: var(--admin-success, #4CAF50);
            }
            
            .admin-notification.error {
                background-color: var(--admin-danger, #F44336);
            }
            
            .admin-notification.info {
                background-color: var(--admin-info, #2196F3);
            }
            
            .admin-notification.warning {
                background-color: var(--admin-warning, #FF9800);
            }
            
            .admin-notification-close {
                background: none;
                border: none;
                color: #fff;
                cursor: pointer;
                font-size: 18px;
                margin-left: 15px;
                opacity: 0.7;
                transition: opacity 0.2s;
            }
            
            .admin-notification-close:hover {
                opacity: 1;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Show a notification
     * @param {String} message - Notification message
     * @param {String} type - Notification type (success, error, info, warning)
     * @param {Number} duration - Duration in milliseconds (default: 5000)
     */
    show(message, type = 'info', duration = 5000) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `admin-notification ${type}`;
        
        // Add message
        const messageEl = document.createElement('div');
        messageEl.className = 'admin-notification-message';
        messageEl.textContent = message;
        notification.appendChild(messageEl);
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'admin-notification-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => this.close(notification));
        notification.appendChild(closeBtn);
        
        // Add to container
        this.container.appendChild(notification);
        
        // Auto-close after duration
        if (duration > 0) {
            setTimeout(() => {
                this.close(notification);
            }, duration);
        }
        
        return notification;
    }
    
    /**
     * Close a notification
     * @param {HTMLElement} notification - Notification element
     */
    close(notification) {
        notification.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => {
            if (notification.parentNode === this.container) {
                this.container.removeChild(notification);
            }
        }, 300);
    }
    
    /**
     * Show a success notification
     * @param {String} message - Notification message
     * @param {Number} duration - Duration in milliseconds (default: 5000)
     */
    success(message, duration = 5000) {
        return this.show(message, 'success', duration);
    }
    
    /**
     * Show an error notification
     * @param {String} message - Notification message
     * @param {Number} duration - Duration in milliseconds (default: 5000)
     */
    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }
    
    /**
     * Show an info notification
     * @param {String} message - Notification message
     * @param {Number} duration - Duration in milliseconds (default: 5000)
     */
    info(message, duration = 5000) {
        return this.show(message, 'info', duration);
    }
    
    /**
     * Show a warning notification
     * @param {String} message - Notification message
     * @param {Number} duration - Duration in milliseconds (default: 5000)
     */
    warning(message, duration = 5000) {
        return this.show(message, 'warning', duration);
    }
}

// Create a global instance
window.adminNotifications = new AdminNotifications();

// Add global showNotification function for compatibility
window.showNotification = function(message, type = 'info', duration = 5000) {
    return window.adminNotifications.show(message, type, duration);
};

console.log('✅ Admin Notifications system loaded successfully');
