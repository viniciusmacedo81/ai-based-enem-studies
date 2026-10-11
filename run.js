// ==========================================
// MODO RUN (ROGUELIKE)
// Carregado depois do script.js: usa as variáveis e funções dele
// (questaoEnemAtual, assistenciaIA, carregarQuestao, mostrarTela...).
// ==========================================
const MAX_VIDAS = 3;
const MOEDAS_POR_ACERTO = 3;
const MOEDAS_CHEFE = 8;
const ANDARES_ATE_CHEFE = 5;
const CARTAS_POR_RUN = 3;
const CHAVE_RECORDE = 'quizEnemRecordeRun';

const hudRun = document.getElementById('run-hud');
const vidasElement = document.getElementById('run-vidas');
const andarNumElement = document.getElementById('run-andar-num');
const andarSubElement = document.getElementById('run-andar-sub');
const trilhaElement = document.getElementById('run-trilha');
const moedasElement = document.getElementById('run-moedas');
const dicaElement = document.getElementById('run-dica');
const efeitosElement = document.getElementById('run-efeitos');
const mensagemElement = document.getElementById('run-msg');
const acoesElement = document.getElementById('run-acoes');
const lojaElement = document.getElementById('run-loja');
const cartasElement = document.getElementById('run-cartas');

let run = null;              // estado da partida; null fora do modo Run
let controladorDica = null;  // AbortController do pedido da dica à IA

const SVG_CORACAO = (estado) =>
    `<svg class="coracao ${estado}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
const SVG_MOEDA =
    '<svg class="icone-moeda" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/></svg>';

// ==========================================
// UTILITÁRIOS
// ==========================================
function embaralhar(lista) {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
}

function textoMoedas(n) {
    return n === 1 ? '1 moeda' : `${n} moedas`;
}

// localStorage pode estar bloqueado (aba anônima, por exemplo): o recorde é um extra
function lerRecorde() {
    try {
        return parseInt(localStorage.getItem(CHAVE_RECORDE), 10) || 0;
    } catch (e) {
        return 0;
    }
}

function salvarRecorde(valor) {
    try {
        localStorage.setItem(CHAVE_RECORDE, String(valor));
    } catch (e) { /* sem armazenamento: segue sem salvar */ }
}

function atualizarRecordeMenu() {
    const el = document.getElementById('recorde-menu');
    const recorde = lerRecorde();
    el.hidden = recorde <= 0;
    el.textContent = recorde > 0 ? `Recorde: ${recorde} ${recorde === 1 ? 'andar' : 'andares'}` : '';
}

// ==========================================
// AS 9 CARTAS DE VANTAGEM
// bloqueio(): texto do motivo se não dá para usar agora, ou null
// ativa(): true enquanto o efeito está armado na questão atual
// usar(): aplica o efeito e devolve a mensagem para o jogador
// ==========================================
function indicesAtivos() {
    // Alternativas ainda em jogo: nem eliminadas por carta, nem já descartadas por erro
    return questaoEnemAtual.alternatives.map((_, i) => i).filter(i => !run.q.fora.has(i));
}

function botaoDaAlternativa(i) {
    return answerButtonsElement.querySelector(`button[data-indice="${i}"]`);
}

function eliminarAlternativas(quantidade) {
    const erradas = indicesAtivos().filter(i => !questaoEnemAtual.alternatives[i].isCorrect);
    embaralhar(erradas).slice(0, quantidade).forEach(i => {
        run.q.fora.add(i);
        const botao = botaoDaAlternativa(i);
        botao.disabled = true;
        botao.classList.add('eliminada');
    });
}

const vidasCheias = () => run.vidas >= MAX_VIDAS;

const CARTAS = [
    {
        id: 'corte', nome: 'Corte', preco: 3,
        desc: 'Elimina uma alternativa errada.',
        bloqueio: () => indicesAtivos().length < 3 ? 'Restam poucas alternativas' : null,
        usar: () => { eliminarAlternativas(1); return 'Uma alternativa errada foi eliminada.'; }
    },
    {
        id: 'corte-duplo', nome: 'Corte duplo', preco: 5,
        desc: 'Elimina duas alternativas erradas.',
        bloqueio: () => indicesAtivos().length < 4 ? 'Restam poucas alternativas' : null,
        usar: () => { eliminarAlternativas(2); return 'Duas alternativas erradas foram eliminadas.'; }
    },
    {
        id: 'dica', nome: 'Dica relâmpago', preco: 3,
        desc: 'A IA dá uma pista sobre esta questão, sem entregar a resposta.',
        bloqueio: () => {
            if (!assistenciaIA) return 'Assistência de IA desligada';
            if (run.q.usadas.has('dica')) return 'Já usada nesta questão';
            return null;
        },
        ativa: () => run.q.usadas.has('dica'),
        usar: null // assíncrona: ver pedirDica()
    },
    {
        id: 'cura', nome: 'Cura', preco: 4,
        desc: 'Se você acertar esta questão, recupera 1 vida.',
        bloqueio: () => run.q.cura ? 'Ativa nesta questão' : (vidasCheias() ? 'Vidas cheias' : null),
        ativa: () => run.q.cura,
        usar: () => { run.q.cura = true; return 'Cura ativa: acerte esta questão para recuperar 1 vida.'; }
    },
    {
        id: 'pocao', nome: 'Poção', preco: 8,
        desc: 'Recupera 1 vida agora.',
        bloqueio: () => vidasCheias() ? 'Vidas cheias' : null,
        usar: () => { run.vidas++; return 'Você recuperou 1 vida.'; }
    },
    {
        id: 'escudo', nome: 'Escudo', preco: 5,
        desc: 'Se errar esta questão, você não perde vida.',
        bloqueio: () => run.q.escudo ? 'Ativa nesta questão' : null,
        ativa: () => run.q.escudo,
        usar: () => { run.q.escudo = true; return 'Escudo ativo: um erro nesta questão não custa vida.'; }
    },
    {
        id: 'segunda-chance', nome: 'Segunda chance', preco: 4,
        desc: 'Depois de um erro, você escolhe outra alternativa.',
        bloqueio: () => run.q.segunda ? 'Ativa nesta questão' : null,
        ativa: () => run.q.segunda,
        usar: () => { run.q.segunda = true; return 'Segunda chance ativa: o primeiro erro não encerra a questão.'; }
    },
    {
        id: 'dobro', nome: 'Moeda em dobro', preco: 2,
        desc: 'Dobra as moedas desta questão se você acertar.',
        bloqueio: () => run.q.dobro ? 'Ativa nesta questão' : null,
        ativa: () => run.q.dobro,
        usar: () => { run.q.dobro = true; return 'Moedas em dobro ativas para esta questão.'; }
    },
    {
        id: 'salto', nome: 'Salto', preco: 4,
        desc: 'Troca esta questão por outra, sem perder vida.',
        bloqueio: () => null,
        usar: () => { carregarQuestao(); return ''; }
    }
];

// ==========================================
// INÍCIO, FIM E RECORDE
// ==========================================
function sortearCartas() {
    // Sem IA ligada na hora de começar, a Dica relâmpago nem entra no sorteio
    const pool = CARTAS.filter(c => c.id !== 'dica' || assistenciaIA);
    return embaralhar(pool).slice(0, CARTAS_POR_RUN);
}

function prepararTelaRun() {
    run = {
        ativa: true,
        vidas: MAX_VIDAS,
        moedas: 0,
        andar: 1,
        acertos: 0,
        respondidas: 0,
        moedasGanhas: 0,
        cartasUsadas: 0,
        cartas: sortearCartas(),
        q: null
    };
    quizScreen.classList.add('modo-run');
    hudRun.hidden = false;
    lojaElement.hidden = false;
    montarLoja();
    renderizarHud();
}

function sairDoModoRun() {
    run = null;
    quizScreen.classList.remove('modo-run');
    hudRun.hidden = true;
    lojaElement.hidden = true;
    limparFeedback();
    limparDica();
}

function novaRun() {
    comecarJogo(modoSelecionado, 'run');
}

// Fecha a run e salva o recorde. Devolve se foi um novo recorde.
function encerrarRun() {
    run.ativa = false;
    const concluidos = run.andar - 1;
    const novoRecorde = concluidos > lerRecorde();
    if (novoRecorde) salvarRecorde(concluidos);
    return novoRecorde;
}

function terminarRun() {
    const novoRecorde = encerrarRun();
    const concluidos = run.andar - 1;
    const precisao = run.respondidas ? Math.round((run.acertos / run.respondidas) * 100) : 0;

    document.getElementById('run-fim-sub').textContent = `Você caiu no andar ${run.andar}.`;
    document.getElementById('fim-andares').textContent = concluidos;
    document.getElementById('fim-acertos').textContent = `${run.acertos} de ${run.respondidas}`;
    document.getElementById('fim-precisao').textContent = `${precisao}%`;
    document.getElementById('fim-moedas').textContent = run.moedasGanhas;
    document.getElementById('fim-cartas').textContent = run.cartasUsadas;
    document.getElementById('fim-recorde').textContent = lerRecorde();
    document.getElementById('fim-novo-recorde').hidden = !novoRecorde || concluidos === 0;
    document.getElementById('fim-nova-desc').textContent =
        { ambos: 'Ambos os dias', dia1: '1º dia', dia2: '2º dia' }[modoSelecionado] + ', com 3 cartas novas';

    mostrarTela('fim');
    document.getElementById('run-fim-titulo').focus();
}

// ==========================================
// HUD: VIDAS, ANDAR, MOEDAS
// ==========================================
function renderizarHud() {
    if (!run) return;

    let coracoes = '';
    for (let i = 0; i < MAX_VIDAS; i++) coracoes += SVG_CORACAO(i < run.vidas ? 'cheio' : 'vazio');
    vidasElement.innerHTML = coracoes;
    vidasElement.setAttribute('aria-label', `Vidas: ${run.vidas} de ${MAX_VIDAS}`);

    moedasElement.textContent = run.moedas;

    // Posição dentro do bloco de 5 andares; o último é a sala do chefe
    const posicao = ((run.andar - 1) % ANDARES_ATE_CHEFE) + 1;
    const chefe = posicao === ANDARES_ATE_CHEFE;
    andarNumElement.textContent = `Andar ${run.andar}`;
    andarSubElement.textContent = chefe
        ? `Sala do chefe: ${MOEDAS_CHEFE} moedas`
        : `Chefe no andar ${Math.ceil(run.andar / ANDARES_ATE_CHEFE) * ANDARES_ATE_CHEFE}`;

    let trilha = '';
    for (let i = 1; i <= ANDARES_ATE_CHEFE; i++) {
        const classes = ['trilha-seg'];
        if (i < posicao) classes.push('feito');
        if (i === posicao) classes.push('atual');
        if (i === ANDARES_ATE_CHEFE) classes.push('chefe');
        trilha += `<span class="${classes.join(' ')}"></span>`;
    }
    trilhaElement.innerHTML = trilha;
}

// ==========================================
// FEEDBACK E EFEITOS ATIVOS
// ==========================================
function limparFeedback() {
    mensagemElement.hidden = true;
    mensagemElement.textContent = '';
    acoesElement.innerHTML = '';
    atualizarEfeitos();
}

function mostrarMensagem(texto, continuar) {
    mensagemElement.textContent = texto;
    mensagemElement.hidden = !texto;
    acoesElement.innerHTML = '';
    if (continuar) {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'run-continuar';
        botao.textContent = continuar.rotulo;
        botao.addEventListener('click', continuar.acao);
        acoesElement.appendChild(botao);
        botao.focus();
    }
}

function atualizarEfeitos() {
    const q = run && run.q;
    const ativos = [];
    if (q && !q.respondida) {
        CARTAS.forEach(c => {
            // 'dica' fica registrada em usadas, mas o efeito dela é o texto exibido
            if (c.id !== 'dica' && c.ativa && c.ativa()) ativos.push(c.nome);
        });
    }
    efeitosElement.hidden = ativos.length === 0;
    efeitosElement.textContent = ativos.length ? `Em efeito nesta questão: ${ativos.join(' · ')}` : '';
}

function limparDica() {
    dicaElement.hidden = true;
    dicaElement.innerHTML = '';
}

// ==========================================
// CICLO DE UMA QUESTÃO NA RUN
// ==========================================
// Chamada no começo de cada carregamento: trava a loja até a questão aparecer
function prepararCarregamentoRun() {
    if (!run) return;
    run.q = null;
    limparFeedback();
    limparDica();
    renderizarHud();
    atualizarLoja();
}

// Chamada por mostrarQuestao() quando a questão já está na tela
function iniciarQuestaoRun() {
    if (!run || !run.ativa) return;
    run.q = {
        fora: new Set(),     // índices eliminados por carta ou já descartados por erro
        usadas: new Set(),
        cura: false,
        escudo: false,
        segunda: false,
        dobro: false,
        respondida: false,
        pendente: false      // dica da IA a caminho
    };
    limparFeedback();
    limparDica();
    renderizarHud();
    atualizarLoja();
}

function responderRun(indice, botao) {
    const q = run && run.q;
    if (!q || q.respondida || q.fora.has(indice)) return;

    // Respondeu com a dica ainda a caminho: a dica não é mais necessária nem cobrada
    cancelarDica();
    limparDica();

    const alternativas = questaoEnemAtual.alternatives;
    const escolhida = alternativas[indice];
    const botoes = [...answerButtonsElement.querySelectorAll('button')];
    const travarTodos = () => botoes.forEach(b => b.disabled = true);

    if (escolhida.isCorrect) {
        q.respondida = true;
        run.respondidas++;
        run.acertos++;

        const chefe = run.andar % ANDARES_ATE_CHEFE === 0;
        const ganho = (chefe ? MOEDAS_CHEFE : MOEDAS_POR_ACERTO) * (q.dobro ? 2 : 1);
        run.moedas += ganho;
        run.moedasGanhas += ganho;

        const curou = q.cura && !vidasCheias();
        if (curou) run.vidas++;

        run.andar++;
        botao.classList.add('btn-correct');
        travarTodos();

        const partes = [chefe ? 'Chefe derrotado.' : 'Correta.', `+${textoMoedas(ganho)}.`];
        if (curou) partes.push('Você recuperou 1 vida.');
        mostrarMensagem(partes.join(' '), { rotulo: 'Próximo andar', acao: () => carregarQuestao() });

    } else {
        botao.classList.add('btn-wrong');
        botao.disabled = true;
        q.fora.add(indice);

        // Segunda chance: o primeiro erro não encerra a questão
        if (q.segunda) {
            q.segunda = false;
            mostrarMensagem('Incorreta. Segunda chance: escolha outra alternativa.');
            atualizarEfeitos();
            atualizarLoja();
            return;
        }

        q.respondida = true;
        run.respondidas++;

        // Mostra a resposta certa: é o que torna a run também uma sessão de estudo
        const certa = alternativas.findIndex(a => a.isCorrect);
        botoes[certa].classList.add('btn-correct');
        travarTodos();

        const partes = [`Incorreta. A resposta certa é ${alternativas[certa].letter}.`];
        if (q.escudo) {
            partes.push('O escudo absorveu o erro: nenhuma vida perdida.');
        } else {
            run.vidas--;
            partes.push('Você perdeu 1 vida.');
        }

        if (run.vidas <= 0) {
            partes.push('Fim da run.');
            mostrarMensagem(partes.join(' '), { rotulo: 'Ver resultado', acao: terminarRun });
        } else {
            mostrarMensagem(partes.join(' '), { rotulo: 'Continuar', acao: () => carregarQuestao() });
        }
    }

    atualizarEfeitos();
    renderizarHud();
    atualizarLoja();
}

// ==========================================
// LOJA DE CARTAS
// ==========================================
function montarLoja() {
    cartasElement.innerHTML = '';
    run.cartas.forEach(carta => {
        const li = document.createElement('li');
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'carta';
        botao.innerHTML =
            '<span class="carta-topo">'
            + `<span class="carta-nome">${carta.nome}</span>`
            + `<span class="carta-preco" aria-label="${textoMoedas(carta.preco)}">${SVG_MOEDA}${carta.preco}</span>`
            + '</span>'
            + `<span class="carta-desc">${carta.desc}</span>`
            + '<span class="carta-estado"></span>';
        botao.addEventListener('click', () => comprarCarta(carta));
        li.appendChild(botao);
        cartasElement.appendChild(li);
        carta.el = botao;
    });
}

// Motivo pelo qual a carta não pode ser comprada agora, ou null se pode
function motivoBloqueio(carta) {
    const especifico = carta.bloqueio();
    if (especifico) return especifico;
    if (run.moedas < carta.preco) {
        const falta = carta.preco - run.moedas;
        return falta === 1 ? 'Falta 1 moeda' : `Faltam ${falta} moedas`;
    }
    return null;
}

function atualizarLoja() {
    if (!run) return;
    const q = run.q;
    const parada = !q || q.respondida || q.pendente; // sem questão, já respondida ou esperando a IA
    run.cartas.forEach(carta => {
        const motivo = parada ? '' : (motivoBloqueio(carta) || '');
        carta.el.disabled = parada || !!motivo;
        carta.el.classList.toggle('ativa', !!(q && !q.respondida && carta.ativa && carta.ativa()));
        carta.el.querySelector('.carta-estado').textContent = motivo;
    });
}

function comprarCarta(carta) {
    const q = run && run.q;
    if (!q || q.respondida || q.pendente || motivoBloqueio(carta)) return;

    if (carta.id === 'dica') {
        pedirDica(carta);
        return;
    }

    run.moedas -= carta.preco;
    run.cartasUsadas++;
    const mensagem = carta.usar();
    if (carta.id === 'salto') return; // já está carregando outra questão

    mostrarMensagem(mensagem);
    atualizarEfeitos();
    renderizarHud();
    atualizarLoja();
}

// ==========================================
// DICA RELÂMPAGO (IA)
// ==========================================
function cancelarDica() {
    if (controladorDica) {
        controladorDica.abort();
        controladorDica = null;
    }
}

async function pedirDica(carta) {
    const q = run.q;
    const id = cargaId;
    q.pendente = true;
    atualizarLoja();

    dicaElement.hidden = false;
    dicaElement.innerHTML = '<p class="status">A IA está pensando em uma dica...</p>'
        + '<button type="button" id="btn-cancelar-dica" class="btn-pular">Cancelar</button>';
    document.getElementById('btn-cancelar-dica').addEventListener('click', () => {
        cancelarDica();
        limparDica();
    });

    const controlador = new AbortController();
    controladorDica = controlador;
    const alternativas = questaoEnemAtual.alternatives;

    try {
        const resposta = await fetch('/api/dica', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controlador.signal,
            body: JSON.stringify({
                contexto: questaoEnemAtual.context,
                enunciado: questaoEnemAtual.alternativesIntroduction,
                alternativas: alternativas.map(a => ({ letra: a.letter, texto: a.text || '' })),
                gabarito: (alternativas.find(a => a.isCorrect) || {}).letter,
                imagens: questaoEnemAtual.files || []
            })
        });
        const json = await resposta.json();
        if (id !== cargaId || run.q !== q || controlador.signal.aborted) return;
        if (!resposta.ok || !json.dica) throw new Error('A IA não devolveu uma dica');

        // Só cobra quando a dica realmente chegou
        run.moedas -= carta.preco;
        run.cartasUsadas++;
        q.usadas.add('dica');

        dicaElement.innerHTML = '<p class="run-dica-rotulo">Dica da IA</p><p class="run-dica-texto"></p>';
        dicaElement.querySelector('.run-dica-texto').textContent = json.dica;
    } catch (erro) {
        if (controlador.signal.aborted || id !== cargaId || run.q !== q) return;
        console.error('Erro ao pedir a dica:', erro);
        dicaElement.innerHTML = '<p class="status">Não foi possível gerar a dica. Nenhuma moeda foi cobrada.</p>';
    } finally {
        if (controladorDica === controlador) controladorDica = null;
        if (run && run.q === q) {
            q.pendente = false;
            renderizarHud();
            atualizarLoja();
        }
    }
}

atualizarRecordeMenu();
