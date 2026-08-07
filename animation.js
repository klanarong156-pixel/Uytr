// Animation Controller - Premium pump animations (rAF-driven, non-blocking, no layout shift)

class AnimationController {
    constructor(){
        this.pumpCard = null;
        this.rotor = null;
        this.waterPath = null;
        this.droplets = [];
        this.running = false;
        this._raf = null;
        this._last = performance.now();
        this.rotation = 0; // degrees
        this.flowOffset = 0; // for stroke dashoffset
        this.ripples = [];
        this.init();
    }

    init(){
        // Delay until DOM ready
        if (document.readyState === 'loading'){
            document.addEventListener('DOMContentLoaded', () => this._bind());
        } else {
            this._bind();
        }
    }

    _bind(){
        this.pumpCard = document.getElementById('card-pump');
        this.rotor = document.querySelector('.pump-rotor');
        this.waterPath = document.querySelector('.water-flow');
        this.droplets = Array.from(document.querySelectorAll('.droplet'));

        // Make sure elements exist; if not, create minimal safe structure
        if (!this.pumpCard) return;

        // Prepare GPU-friendly properties
        this.pumpCard.style.willChange = 'transform, opacity';
        if (this.rotor) this.rotor.style.willChange = 'transform';
        if (this.waterPath) this.waterPath.style.willChange = 'stroke-dashoffset, opacity';

        // Event delegation for ripple on pump card
        this.pumpCard.addEventListener('click', (e) => {
            this.createRipple(e);
        });

        // Start idle state
        this.setPumpState('idle');
    }

    setPumpState(state){
        // States: 'idle', 'connecting', 'running', 'error'
        if (!this.pumpCard) {
            // if not yet bound, store desired state and bind will apply
            this._pendingState = state;
            return;
        }

        // Clear classes
        this.pumpCard.classList.remove('state-idle', 'state-connecting', 'state-running', 'state-error');
        this.pumpCard.classList.add(`state-${state}`);

        switch(state){
            case 'running':
                this.start();
                this._setGlow(true);
                break;
            case 'connecting':
                this.start(0.4); // slow animation for connecting
                this._setGlow(false);
                break;
            case 'error':
                this.stop();
                this._setGlow(false);
                break;
            default:
                this.stop();
                this._fadeOutEffects();
                break;
        }
    }

    start(speedFactor = 1){
        if (this.running) return;
        this.running = true;
        this.speedFactor = speedFactor;
        this._last = performance.now();
        this._loop();
    }

    stop(){
        this.running = false;
        if (this._raf){
            cancelAnimationFrame(this._raf);
            this._raf = null;
        }
        // gently fade water and rotor
        if (this.waterPath) this.waterPath.style.transition = 'opacity 500ms ease';
        if (this.rotor) this.rotor.style.transition = 'transform 500ms ease, opacity 500ms ease';
    }

    _loop(){
        if (!this.running) return;
        const now = performance.now();
        const dt = Math.min(40, now - this._last); // cap dt to avoid jumps
        this._last = now;

        // rotation speed (deg per second)
        const rotSpeed = 220 * (this.speedFactor || 1); // base
        this.rotation = (this.rotation + (rotSpeed * dt / 1000)) % 360;
        if (this.rotor) this.rotor.style.transform = `rotate(${this.rotation}deg)`;

        // water flow: animate stroke-dashoffset
        if (this.waterPath){
            this.flowOffset = (this.flowOffset + (120 * (this.speedFactor || 1) * dt / 1000)) % 1000;
            try{
                // set via style to avoid layout
                this.waterPath.style.strokeDashoffset = `${this.flowOffset}`;
                this.waterPath.style.opacity = '1';
            }catch(e){}
        }

        // droplet subtle translation via CSS variable updated here
        this.droplets.forEach((d, i) => {
            const phase = (now / 600) + i * 0.6;
            const tx = Math.sin(phase) * 6;
            const ty = -Math.abs(Math.sin(phase * 1.3)) * 18 - 6;
            d.style.transform = `translate(${tx}px, ${ty}px) scale(${0.9 + Math.abs(Math.sin(phase))*0.2})`;
            d.style.opacity = '1';
        });

        // ripple spawning occasionally
        if (Math.random() < 0.06){
            this._spawnRipple();
        }

        this._raf = requestAnimationFrame(() => this._loop());
    }

    _spawnRipple(){
        const el = document.createElement('span');
        el.className = 'pump-ripple';
        // position in center of sprinkler area
        const rect = this.pumpCard.getBoundingClientRect();
        el.style.left = '70%';
        el.style.top = '28%';
        this.pumpCard.appendChild(el);
        // remove after animation
        setTimeout(()=> el.remove(), 1000);
    }

    _setGlow(enabled){
        if (!this.pumpCard) return;
        if (enabled){
            this.pumpCard.classList.add('glow-emerald', 'pulse-glow');
        } else {
            this.pumpCard.classList.remove('glow-emerald', 'pulse-glow');
        }
    }

    _fadeOutEffects(){
        if (this.waterPath) this.waterPath.style.opacity = '0';
        if (this.rotor) this.rotor.style.opacity = '0.6';
        this._setGlow(false);
    }

    createRipple(e){
        if (!this.pumpCard) return;
        const el = document.createElement('span');
        el.className = 'ripple-effect';
        const rect = this.pumpCard.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 0.6;
        const x = (e.clientX - rect.left) - size / 2;
        const y = (e.clientY - rect.top) - size / 2;
        el.style.width = el.style.height = `${size}px`;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        this.pumpCard.appendChild(el);
        setTimeout(()=> el.remove(), 700);
    }
}

// Preserve existing global
if (!window.animationController){
    window.animationController = new AnimationController();
} else {
    // if existed, update instance methods but keep object
    try{ window.animationController.__proto__ = AnimationController.prototype; }catch(e){}
}
