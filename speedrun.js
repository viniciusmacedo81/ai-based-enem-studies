// ==========================================
// MODO SPEEDRUN
// Carregado depois do script.js e do run.js: reaproveita as mensagens e o botão de
// continuar da run (mostrarMensagem, limparFeedback) e as variáveis do script.js.
// ==========================================
const LIMITE_SEGUNDOS = 240;       // 4 minutos por questão
const RITMO_PROVA_SEGUNDOS = 220;  // 330 min / 90 questões = 3min40s
const PONTOS_MAX = 1000;           // resposta imediata
const PONTOS_MIN = 100;            // acerto no limite do tempo
const AVISO_SEGUNDOS = 30;         // últimos segundos: o relógio fica em alerta
const CHAVE_RECORDE_SPEED = 'quizEnemRecordeSpeedrun';

const speedHud = document.getElementById('speed-hud');
const speedTimerElement = document.getElementById('speed-timer');
const speedBarraElement = document.getElementById('speed-barra');
const speedRespondidasElement = document.getElementById('speed-respondidas');
const speedScoreElement = document.getElementById('speed-score');

let speed = null;          // estado da partida; null fora do modo Speedrun
let intervaloSpeed = null; // setInterval do cronômetro

// ==========================================
// UTILITÁRIOS
// ==========================================
// 75 -> "1:15"
function formatarTempo(segundos) {
    const total = Math.max(0, Math.round(segundos));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// De 1000 (instantâneo) a 100 (no limite), linear com o tempo gasto
function pontosPorTempo(segundos) {
    const fracao = Math.min(1, Math.max(0, segundos / LIMITE_SEGUNDOS));
    return Math.round(PONTOS_MIN + (PONTOS_MAX - PONTOS_MIN) * (1 - fracao));
}

function lerRecordeSpeed() {
    try {
        return parseInt(localStorage.getItem(CHAVE_RECORDE_SPEED), 10) || 0;
    } catch (e) {
        return 0;
    }
}

function salvarRecordeSpeed(valor) {
    try {
        localStorage.setItem(CHAVE_RECORDE_SPEED, String(valor));
    } catch (e) { /* sem armazenamento: segue sem salvar */ }
}

function atualizarRecordeSpeedMenu() {
    const el = document.getElementById('recorde-speed');
    const recorde = lerRecordeSpeed();
    el.hidden = recorde <= 0;
    el.textContent = recorde > 0 ? `Melhor pontuação: ${recorde}` : '';
}

// ==========================================
// INÍCIO, FIM E RECORDE
// ==========================================
function prepararSpeedrun() {
    pararCronometro();
    speed = {
        ativa: true,
        score: 0,
        acertos: 0,
        tempoTotal: 0,   // soma do tempo gasto em todas as questões, inclusive a última
        tempoAcertos: 0, // soma só das questões acertadas (base da média)
        motivo: '',      // 'erro' ou 'tempo'
        q: null
    };
    quizScreen.classList.add('modo-speedrun');
    speedHud.hidden = false;
    renderizarSpeedHud(LIMITE_SEGUNDOS);
}

function sairDoSpeedrun() {
    pararCronometro();
    speed = null;
    quizScreen.classList.remove('modo-speedrun');
    speedHud.hidden = true;
}

function novaSpeedrun() {
    comecarJogo(modoSelecionado, 'speedrun');
}

// Fecha a partida e salva a melhor pontuação. Devolve se foi um novo recorde.
function encerrarSpeedrun() {
    pararCronometro();
    speed.ativa = false;
    const novoRecorde = speed.score > lerRecordeSpeed();
    if (novoRecorde) salvarRecordeSpeed(speed.score);
    return novoRecorde;
}

function terminarSpeedrun() {
    const novoRecorde = encerrarSpeedrun();
    Som.tocar('fim');
    const media = speed.acertos ? speed.tempoAcertos / speed.acertos : null;

    document.getElementById('speed-fim-sub').textContent =
        speed.motivo === 'tempo' ? 'O tempo da questão esgotou.' : 'Você errou uma questão.';
    document.getElementById('sf-score').textContent = speed.score;
    document.getElementById('sf-respondidas').textContent = speed.acertos;
    document.getElementById('sf-media').textContent = media === null ? '-' : formatarTempo(media);
    document.getElementById('sf-total').textContent = formatarTempo(speed.tempoTotal);
    document.getElementById('sf-recorde').textContent = lerRecordeSpeed();
    document.getElementById('sf-novo-recorde').hidden = !novoRecorde || speed.score === 0;

    const ritmo = document.getElementById('sf-ritmo');
    if (media === null) {
        ritmo.textContent = '';
    } else {
        const diferenca = Math.round(Math.abs(RITMO_PROVA_SEGUNDOS - media));
        const ritmoTexto = formatarTempo(RITMO_PROVA_SEGUNDOS);
        ritmo.textContent = media <= RITMO_PROVA_SEGUNDOS
            ? `Sua média ficou ${diferenca} s abaixo do ritmo da prova (${ritmoTexto} por questão).`
            : `Sua média ficou ${diferenca} s acima do ritmo da prova (${ritmoTexto} por questão).`;
    }
    document.getElementById('sf-nova-desc').textContent =
        { ambos: 'Ambos os dias', dia1: '1º dia', dia2: '2º dia' }[modoSelecionado];

    mostrarTela('fim-speed');
    document.getElementById('speed-fim-titulo').focus();
}

// ==========================================
// HUD E CRONÔMETRO
// ==========================================
function renderizarSpeedHud(restante) {
    if (!speed) return;
    speedScoreElement.textContent = speed.score;
    speedRespondidasElement.textContent = speed.acertos === 1 ? '1 respondida' : `${speed.acertos} respondidas`;

    // Arredonda para cima: com 0,4 s sobrando o relógio ainda mostra 0:01
    speedTimerElement.textContent = formatarTempo(Math.ceil(Math.max(0, restante)));
    speedBarraElement.style.width = `${Math.max(0, Math.min(1, restante / LIMITE_SEGUNDOS)) * 100}%`;
    const urgente = restante <= AVISO_SEGUNDOS;
    speedTimerElement.classList.toggle('urgente', urgente);
    speedBarraElement.classList.toggle('urgente', urgente);
}

function pararCronometro() {
    if (intervaloSpeed) {
        clearInterval(intervaloSpeed);
        intervaloSpeed = null;
    }
}

// Segundos gastos na questão atual, medidos pelo relógio (não por contagem de ticks,
// que atrasa quando a aba fica em segundo plano)
function tempoGasto(q) {
    return Math.min(LIMITE_SEGUNDOS, (performance.now() - q.inicio) / 1000);
}

function tique(q) {
    if (!speed || speed.q !== q || q.respondida) return;
    const gasto = tempoGasto(q);
    renderizarSpeedHud(LIMITE_SEGUNDOS - gasto);

    // Nos últimos 10 s, um tique por segundo
    const segundo = Math.ceil(LIMITE_SEGUNDOS - gasto);
    if (segundo <= 10 && segundo > 0 && q.ultimoTique !== segundo) {
        q.ultimoTique = segundo;
        Som.tocar('tique');
    }
    if (gasto >= LIMITE_SEGUNDOS) tempoEsgotado(q);
}

// ==========================================
// CICLO DE UMA QUESTÃO
// ==========================================
// Durante o carregamento o relógio fica parado: a espera da rede não é culpa do aluno
function prepararCarregamentoSpeed() {
    if (!speed) return;
    pararCronometro();
    speed.q = null;
    limparFeedback();
    renderizarSpeedHud(LIMITE_SEGUNDOS);
}

// Chamada por mostrarQuestao() quando a questão já está na tela: aqui o relógio começa
function iniciarQuestaoSpeed() {
    if (!speed || !speed.ativa) return;
    const q = { inicio: performance.now(), respondida: false };
    speed.q = q;
    limparFeedback();
    renderizarSpeedHud(LIMITE_SEGUNDOS);
    pararCronometro();
    intervaloSpeed = setInterval(() => tique(q), 100);
}

function revelarCorreta() {
    const alternativas = questaoEnemAtual.alternatives;
    const botoes = [...answerButtonsElement.querySelectorAll('button')];
    botoes.forEach(b => b.disabled = true);
    const certa = alternativas.findIndex(a => a.isCorrect);
    botoes[certa].classList.add('btn-correct');
    return alternativas[certa].letter;
}

function responderSpeed(indice, botao) {
    const q = speed && speed.q;
    if (!q || q.respondida) return;

    const gasto = tempoGasto(q); // medido antes de qualquer outra coisa
    q.respondida = true;
    pararCronometro();
    speed.tempoTotal += gasto;

    if (questaoEnemAtual.alternatives[indice].isCorrect) {
        const pontos = pontosPorTempo(gasto);
        speed.score += pontos;
        speed.acertos++;
        speed.tempoAcertos += gasto;
        botao.classList.add('btn-correct');
        Som.tocar('acerto');
        answerButtonsElement.querySelectorAll('button').forEach(b => b.disabled = true);
        renderizarSpeedHud(LIMITE_SEGUNDOS - gasto);
        mostrarMensagem(`Correta em ${formatarTempo(gasto)}. +${pontos} pontos.`,
            { rotulo: 'Próxima questão', acao: () => carregarQuestao() });
    } else {
        speed.motivo = 'erro';
        Som.tocar('erro');
        botao.classList.add('btn-wrong');
        const letra = revelarCorreta();
        renderizarSpeedHud(LIMITE_SEGUNDOS - gasto);
        mostrarMensagem(`Incorreta. A resposta certa é ${letra}. Fim da run.`,
            { rotulo: 'Ver resultado', acao: terminarSpeedrun });
    }
}

function tempoEsgotado(q) {
    if (q.respondida) return;
    q.respondida = true;
    pararCronometro();
    speed.motivo = 'tempo';
    Som.tocar('erro');
    speed.tempoTotal += LIMITE_SEGUNDOS;
    renderizarSpeedHud(0);
    const letra = revelarCorreta();
    mostrarMensagem(`Tempo esgotado. A resposta certa era ${letra}. Fim da run.`,
        { rotulo: 'Ver resultado', acao: terminarSpeedrun });
}

atualizarRecordeSpeedMenu();
