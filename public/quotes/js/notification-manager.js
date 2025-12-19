// NotificationManager - Sandbox-safe notification system for Kanva Calculator
// Provides success, error, warning, and info notifications without using browser storage

const NotificationManager = {
    // Container for notifications
    container: null,
    notifications: new Map(), // In-memory storage for notifications
    idCounter: 0,

    // Initialize notification system
    initialize: function() {
        this.createContainer();
        console.log('📢 NotificationManager initialized');
    },

    // Create notification container
    createContainer: function() {
        // Remove existing container if present
        const existing = document.getElementById('notificationContainer');
        if (existing) {
            existing.remove();
        }

        // Create new container
        this.container = document.createElement('div');
        this.container.id = 'notificationContainer';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            max-width: 400px;
            pointer-events: none;
        `;
        
        document.body.appendChild(this.container);
    },

    // Show success notification
    showSuccess: function(message, title = 'Success', duration = 5000) {
        return this.show({
            type: 'success',
            title: title,
            message: message,
            duration: duration,
            icon: '✅'
        });
    },

    // Show error notification
    showError: function(message, title = 'Error', duration = 8000) {
        return this.show({
            type: 'error',
            title: title,
            message: message,
            duration: duration,
            icon: '❌'
        });
    },

    // Show warning notification
    showWarning: function(message, title = 'Warning', duration = 6000) {
        return this.show({
            type: 'warning',
            title: title,
            message: message,
            duration: duration,
            icon: '⚠️'
        });
    },

    // Show info notification
    showInfo: function(message, title = 'Info', duration = 4000) {
        return this.show({
            type: 'info',
            title: title,
            message: message,
            duration: duration,
            icon: 'ℹ️'
        });
    },

    // Main show method
    show: function(options) {
        if (!this.container) {
            this.createContainer();
        }

        const id = ++this.idCounter;
        const notification = this.createNotification(id, options);
        
        // Store in memory
        this.notifications.set(id, {
            element: notification,
            options: options,
            timestamp: Date.now()
        });

        // Add to container
        this.container.appendChild(notification);

        // Auto-remove after duration
        if (options.duration > 0) {
            setTimeout(() => {
                this.remove(id);
            }, options.duration);
        }

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        }, 10);

        return id;
    },

    // Create notification element
    createNotification: function(id, options) {
        const notification = document.createElement('div');
        notification.id = `notification-${id}`;
        notification.style.cssText = `
            background: ${this.getBackgroundColor(options.type)};
            color: ${this.getTextColor(options.type)};
            border: 2px solid ${this.getBorderColor(options.type)};
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.3s ease-out;
            pointer-events: auto;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            font-size: 14px;
            line-height: 1.4;
            position: relative;
            overflow: hidden;
            max-width: 100%;
            word-wrap: break-word;
        `;

        notification.innerHTML = `
            <div class="notification-icon" style="
                font-size: 18px;
                min-width: 18px;
                line-height: 1;
            ">${options.icon}</div>
            
            <div class="notification-content" style="flex: 1; min-width: 0;">
                <div class="notification-title" style="
                    font-weight: bold;
                    margin-bottom: 4px;
                    font-size: 15px;
                ">${options.title}</div>
                <div class="notification-message" style="
                    opacity: 0.9;
                    word-wrap: break-word;
                ">${options.message}</div>
            </div>
            
            <button class="notification-close" style="
                background: none;
                border: none;
                cursor: pointer;
                font-size: 18px;
                opacity: 0.5;
                transition: opacity 0.2s ease;
                min-width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: inherit;
                padding: 0;
                margin: 0;
            " onclick="NotificationManager.remove(${id})">×</button>
            
            ${options.duration > 0 ? `
                <div class="notification-progress" style="
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 3px;
                    background: rgba(255, 255, 255, 0.3);
                    width: 100%;
                    transform-origin: left;
                    animation: notificationProgress ${options.duration}ms linear;
                "></div>
            ` : ''}
        `;

        // Add progress bar animation if duration is set
        if (options.duration > 0) {
            this.addProgressAnimation(options.duration);
        }

        return notification;
    },

    // Add CSS animation for progress bar
    addProgressAnimation: function(duration) {
        const styleId = 'notification-progress-style';
        let style = document.getElementById(styleId);
        
        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                @keyframes notificationProgress {
                    from { transform: scaleX(1); }
                    to { transform: scaleX(0); }
                }
            `;
            document.head.appendChild(style);
        }
    },

    // Remove notification
    remove: function(id) {
        const notification = this.notifications.get(id);
        if (notification && notification.element) {
            // Animate out
            notification.element.style.transform = 'translateX(100%)';
            notification.element.style.opacity = '0';
            
            // Remove from DOM after animation
            setTimeout(() => {
                if (notification.element.parentNode) {
                    notification.element.parentNode.removeChild(notification.element);
                }
                this.notifications.delete(id);
            }, 300);
        }
    },

    // Clear all notifications
    clearAll: function() {
        this.notifications.forEach((notification, id) => {
            this.remove(id);
        });
    },

    // Get notification colors
    getBackgroundColor: function(type) {
        const colors = {
            success: 'linear-gradient(135deg, #e8f5e8 0%, #d4f4d4 100%)',
            error: 'linear-gradient(135deg, #ffebee 0%, #fce4ec 100%)',
            warning: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
            info: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)'
        };
        return colors[type] || colors.info;
    },

    getTextColor: function(type) {
        const colors = {
            success: '#17351A',
            error: '#d32f2f',
            warning: '#f57c00',
            info: '#1976d2'
        };
        return colors[type] || colors.info;
    },

    getBorderColor: function(type) {
        const colors = {
            success: '#93D500',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196f3'
        };
        return colors[type] || colors.info;
    },

    // Clean up old notifications (memory management)
    cleanup: function() {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes
        
        this.notifications.forEach((notification, id) => {
            if (now - notification.timestamp > maxAge) {
                this.remove(id);
            }
        });
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        NotificationManager.initialize();
    });
} else {
    NotificationManager.initialize();
}

// Cleanup old notifications every 2 minutes
setInterval(() => {
    NotificationManager.cleanup();
}, 2 * 60 * 1000);

console.log('📢 NotificationManager module loaded successfully');
