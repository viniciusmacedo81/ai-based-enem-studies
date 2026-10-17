// ==========================================
// EFEITOS SONOROS
// Sintetizados no navegador com a Web Audio API: não há arquivos de áudio.
// Uso: Som.tocar('acerto'), Som.tocar('moeda', 0.25) (segundo argumento = atraso em segundos)
// ==========================================
const Som = (function () {
    const CHAVE = 'quizEnemEfeitosLigados';
    const VOLUME_GERAL = 0.8;

    let contexto = null;
    let ligado = true;

    try {
        ligado = localStorage.getItem(CHAVE) !== '0';
    } catch (e) { /* sem armazenamento: começa ligado */ }

    // O navegador só libera o áudio depois de um clique; o contexto nasce no primeiro som
    function obterContexto() {
        if (!contexto) {
            const Classe = window.AudioContext || window.webkitAudioContext;
            if (!Classe) return null;
            contexto = new Classe();
        }
        if (contexto.state === 'suspended') contexto.resume();
        return contexto;
    }

    // Uma nota: frequência (pode deslizar até "ate"), começo, duração e volume
    function nota(ctx, { freq, ate, inicio = 0, duracao = 0.12, tipo = 'sine', volume = 0.15 }) {
        const t0 = ctx.currentTime + inicio;
        const osc = ctx.createOscillator();
        const ganho = ctx.createGain();
        osc.type = tipo;
        osc.frequency.setValueAtTime(freq, t0);
        if (ate) osc.frequency.exponentialRampToValueAtTime(ate, t0 + duracao);

        // Envelope curto: sobe rápido e some, para não estalar
        ganho.gain.setValueAtTime(0.0001, t0);
        ganho.gain.exponentialRampToValueAtTime(volume * VOLUME_GERAL, t0 + 0.01);
        ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + duracao);

        osc.connect(ganho).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + duracao + 0.02);
    }

    // Notas usadas: C5 523, E5 659, G5 784, C6 1047
    const SONS = {
        clique:  [{ freq: 520, duracao: 0.05, tipo: 'triangle', volume: 0.08 }],
        acerto:  [{ freq: 523, duracao: 0.12 }, { freq: 659, inicio: 0.09, duracao: 0.12 }, { freq: 784, inicio: 0.18, duracao: 0.2 }],
        erro:    [{ freq: 220, ate: 110, duracao: 0.3, tipo: 'sawtooth', volume: 0.1 }],
        moeda:   [{ freq: 988, duracao: 0.07, tipo: 'square', volume: 0.06 }, { freq: 1319, inicio: 0.07, duracao: 0.16, tipo: 'square', volume: 0.06 }],
        carta:   [{ freq: 440, ate: 880, duracao: 0.14, tipo: 'triangle', volume: 0.12 }],
        cura:    [{ freq: 392, duracao: 0.1 }, { freq: 523, inicio: 0.08, duracao: 0.1 }, { freq: 659, inicio: 0.16, duracao: 0.1 }, { freq: 784, inicio: 0.24, duracao: 0.18 }],
        vida:    [{ freq: 160, ate: 55, duracao: 0.35, volume: 0.2 }],
        tique:   [{ freq: 1000, duracao: 0.04, volume: 0.07 }],
        chefe:   [{ freq: 523, duracao: 0.1 }, { freq: 659, inicio: 0.08, duracao: 0.1 }, { freq: 784, inicio: 0.16, duracao: 0.1 }, { freq: 1047, inicio: 0.24, duracao: 0.3 }],
        fim:     [{ freq: 392, duracao: 0.2, tipo: 'triangle' }, { freq: 330, inicio: 0.2, duracao: 0.2, tipo: 'triangle' }, { freq: 262, inicio: 0.4, duracao: 0.4, tipo: 'triangle' }]
    };

    function tocar(nome, atraso = 0) {
        if (!ligado || !SONS[nome]) return;
        try {
            const ctx = obterContexto();
            if (!ctx) return;
            SONS[nome].forEach(n => nota(ctx, { ...n, inicio: (n.inicio || 0) + atraso }));
        } catch (e) { /* som é um extra: nunca pode quebrar o quiz */ }
    }

    function definirLigado(valor) {
        ligado = valor;
        try {
            localStorage.setItem(CHAVE, valor ? '1' : '0');
        } catch (e) { /* sem armazenamento: vale só nesta sessão */ }
        if (valor) tocar('clique');
    }

    return { tocar, definirLigado, estaLigado: () => ligado };
})();
