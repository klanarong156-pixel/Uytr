// ==================== PREMIUM UI FEATURES ====================

// Initialize Premium UI
document.addEventListener('DOMContentLoaded', () => {
    initPWAPrompt();
    initMicroInteractions();
});

// Sidebar removed - using bottom navigation only

// ==================== PWA INSTALL PROMPT ====================
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showPWAPrompt();
});

function showPWAPrompt() {
    const prompt = document.getElementById('pwa-install-prompt');
    if (prompt) {
        prompt.style.display = 'flex';
    }
}

function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                showToast('แอปถูกติดตั้งสำเร็จ!', 'success');
            }
            deferredPrompt = null;
            closePWAPrompt();
        });
    }
}

function closePWAPrompt() {
    const prompt = document.getElementById('pwa-install-prompt');
    if (prompt) {
        prompt.style.display = 'none';
    }
}

window.addEventListener('appinstalled', () => {
    showToast('สวนลุงนะ ติดตั้งเป็นแอปแล้ว!', 'success');
    closePWAPrompt();
});

// ==================== MICRO-INTERACTIONS ====================
function initMicroInteractions() {
    // Add glow effect to buttons on hover
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        });
    });

    // Add ripple effect
    buttons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');

            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });

    // Smooth scroll for cards
    const cards = document.querySelectorAll('.tesla-card, .relay-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-4px)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
    });
}

// ==================== HELPER FUNCTION ====================
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
        success: 'bg-gradient-to-r from-emerald-500 to-green-600',
        error: 'bg-gradient-to-r from-rose-500 to-red-600',
        info: 'bg-gradient-to-r from-blue-500 to-cyan-600',
        warning: 'bg-gradient-to-r from-amber-500 to-orange-600'
    };
    
    toast.className = `toast-enter pointer-events-auto px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold ${colors[type] || colors.info} flex items-center gap-2`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.className = toast.className.replace('toast-enter', 'toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
