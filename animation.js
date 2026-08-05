// Animation Controller - Manages premium UI animations

class AnimationController {
    constructor() {
        this.pumpCard = document.getElementById('card-pump');
    }

    setPumpState(state) {
        // States: 'idle', 'connecting', 'running', 'error'
        if (!this.pumpCard) return;

        // Remove all state classes
        this.pumpCard.classList.remove('state-idle', 'state-connecting', 'state-running', 'state-error');
        
        // Add new state class
        this.pumpCard.classList.add(`state-${state}`);

        const statusText = document.getElementById('pumpStatusText');
        const iconBg = document.getElementById('pump-icon-bg');

        switch(state) {
            case 'running':
                statusText.textContent = "กำลังรดน้ำ...";
                statusText.classList.add('text-blue-400');
                statusText.classList.remove('text-[#8E8E93]');
                iconBg.classList.replace('bg-[#007AFF]/20', 'bg-blue-500');
                break;
            case 'connecting':
                statusText.textContent = "กำลังเชื่อมต่อ...";
                statusText.classList.add('text-amber-400');
                break;
            case 'error':
                statusText.textContent = "ข้อผิดพลาด!";
                statusText.classList.add('text-red-400');
                break;
            default:
                statusText.textContent = "หยุดรดน้ำ";
                statusText.classList.remove('text-blue-400', 'text-amber-400', 'text-red-400');
                statusText.classList.add('text-[#8E8E93]');
                iconBg.classList.replace('bg-blue-500', 'bg-[#007AFF]/20');
        }
    }

    createRipple(event, element) {
        const ripple = document.createElement('span');
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        ripple.classList.add('ripple-effect');

        let container = element.querySelector('.ripple-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'ripple-container';
            element.appendChild(container);
        }
        
        container.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    }

    playSpring(element) {
        element.style.transform = 'scale(0.95)';
        setTimeout(() => {
            element.style.transform = 'scale(1)';
        }, 100);
    }
}

window.animationController = new AnimationController();
