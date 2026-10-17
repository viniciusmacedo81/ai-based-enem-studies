// ==========================================
// RÁDIO LOFI
// Toca transmissões ao vivo do YouTube pelo player oficial (IFrame API) com botões próprios.
// O player fica sempre visível e o link de cada transmissão aparece como crédito.
// O YouTube só é carregado quando você clica em Tocar pela primeira vez.
// ==========================================

// Para trocar, tirar ou incluir transmissões, edite só esta lista.
// id = o trecho depois de "watch?v=" no link da transmissão.
const ESTACOES = [
    { id: 'jfKfPfyJRdk', nome: 'Lofi hip hop radio: relax/study', canal: 'Lofi Girl' },
    { id: 'rUxyKA_-grg', nome: 'Lofi hip hop radio: sleep/chill', canal: 'Lofi Girl' },
    { id: '5yx6BWlEVcY', nome: 'Chillhop Radio: jazzy and lofi beats', canal: 'Chillhop Music' },
    { id: '4xDzrJKXOOY', nome: 'Synthwave radio: chill/game', canal: 'Lofi Girl' }
];

const Radio = (function () {
    const CHAVE = 'quizEnemRadio';
    const PASSO_VOLUME = 10;

    const el = {
        video: document.getElementById('radio-video'),
        vazio: document.getElementById('radio-vazio'),
        estado: document.getElementById('radio-estado'),
        nome: document.getElementById('radio-nome'),
        link: document.getElementById('radio-link'),
        tocar: document.getElementById('radio-tocar'),
        anterior: document.getElementById('radio-anterior'),
        proxima: document.getElementById('radio-proxima'),
        menos: document.getElementById('radio-menos'),
        mais: document.getElementById('radio-mais'),
        volume: document.getElementById('radio-volume'),
        efeitos: document.getElementById('radio-efeitos')
    };

    let indice = 0;
    let volume = 50;
    let player = null;
    let tocando = false;
    let errosSeguidos = 0;
    let apiPromessa = null;

    // ---------- Preferências ----------
    try {
        const salvo = JSON.parse(localStorage.getItem(CHAVE) || '{}');
        if (Number.isInteger(salvo.indice) && salvo.indice >= 0 && salvo.indice < ESTACOES.length) indice = salvo.indice;
        if (Number.isInteger(salvo.volume) && salvo.volume >= 0 && salvo.volume <= 100) volume = salvo.volume;
    } catch (e) { /* sem armazenamento ou dado inválido: usa o padrão */ }

    function salvar() {
        try {
            localStorage.setItem(CHAVE, JSON.stringify({ indice, volume }));
        } catch (e) { /* vale só nesta sessão */ }
    }

    // ---------- Tela ----------
    function atualizarTela() {
        const estacao = ESTACOES[indice];
        el.nome.textContent = estacao.nome;
        el.link.textContent = `${estacao.canal} no YouTube`;
        el.link.href = `https://www.youtube.com/watch?v=${estacao.id}`;
        el.tocar.textContent = tocando ? 'Pausar' : 'Tocar';
        el.volume.textContent = `Volume ${volume}%`;
        el.menos.disabled = volume <= 0;
        el.mais.disabled = volume >= 100;
        el.efeitos.textContent = `Efeitos sonoros: ${Som.estaLigado() ? 'ligados' : 'desligados'}`;
    }

    function mostrarEstado(texto) {
        el.estado.textContent = texto;
    }

    // ---------- API do YouTube ----------
    function carregarApi() {
        if (apiPromessa) return apiPromessa;
        apiPromessa = new Promise((resolve, reject) => {
            if (window.YT && window.YT.Player) return resolve();
            const anterior = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if (typeof anterior === 'function') anterior();
                resolve();
            };
            const script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            script.onerror = () => { apiPromessa = null; reject(new Error('falha ao carregar o YouTube')); };
            document.head.appendChild(script);
        });
        return apiPromessa;
    }

    function criarPlayer() {
        mostrarEstado('Carregando...');
        carregarApi().then(() => {
            el.vazio.hidden = true;
            const alvo = document.createElement('div');
            el.video.appendChild(alvo);
            player = new YT.Player(alvo, {
                width: '100%',
                height: '100%',
                videoId: ESTACOES[indice].id,
                host: 'https://www.youtube-nocookie.com',
                playerVars: { autoplay: 1, controls: 0, disablekb: 1, modestbranding: 1, playsinline: 1, rel: 0 },
                events: { onReady: aoFicarPronto, onStateChange: aoMudarEstado, onError: aoDarErro }
            });
        }).catch(() => {
            mostrarEstado('Sem conexão com o YouTube');
        });
    }

    function aoFicarPronto() {
        player.setVolume(volume);
        player.playVideo();
    }

    function aoMudarEstado(evento) {
        const E = YT.PlayerState;
        if (evento.data === E.PLAYING) {
            tocando = true;
            errosSeguidos = 0;
            mostrarEstado('Tocando');
        } else if (evento.data === E.PAUSED) {
            tocando = false;
            mostrarEstado('Pausado');
        } else if (evento.data === E.BUFFERING) {
            mostrarEstado('Carregando...');
        } else if (evento.data === E.ENDED) {
            tocando = false;
            mostrarEstado('Terminou');
        } else {
            tocando = false;
            mostrarEstado('Pronto');
        }
        atualizarTela();
    }

    // Transmissão fora do ar, removida ou sem permissão para incorporar: pula para a próxima
    function aoDarErro() {
        errosSeguidos++;
        tocando = false;
        atualizarTela();
        if (errosSeguidos >= ESTACOES.length) {
            mostrarEstado('Nenhuma transmissão disponível agora');
            return;
        }
        mostrarEstado('Transmissão indisponível, pulando...');
        setTimeout(() => trocar(1), 1500);
    }

    // ---------- Controles ----------
    function alternar() {
        if (!player) {
            tocando = true; // o texto do botão já muda enquanto o YouTube carrega
            atualizarTela();
            criarPlayer();
            return;
        }
        if (tocando) player.pauseVideo();
        else player.playVideo();
    }

    function trocar(direcao) {
        indice = (indice + direcao + ESTACOES.length) % ESTACOES.length;
        salvar();
        if (player) {
            player.loadVideoById(ESTACOES[indice].id);
        }
        atualizarTela();
    }

    function mudarVolume(delta) {
        volume = Math.max(0, Math.min(100, volume + delta));
        if (player) player.setVolume(volume);
        salvar();
        atualizarTela();
    }

    el.tocar.addEventListener('click', alternar);
    el.anterior.addEventListener('click', () => trocar(-1));
    el.proxima.addEventListener('click', () => trocar(1));
    el.menos.addEventListener('click', () => mudarVolume(-PASSO_VOLUME));
    el.mais.addEventListener('click', () => mudarVolume(PASSO_VOLUME));
    el.efeitos.addEventListener('click', () => {
        Som.definirLigado(!Som.estaLigado());
        atualizarTela();
    });

    atualizarTela();
    return { trocar, mudarVolume, alternar };
})();
