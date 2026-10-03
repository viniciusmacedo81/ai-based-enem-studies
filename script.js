// ==========================================
// SELETORES DO ELEMENTO HTML E VARIÁVEIS
// ==========================================
const menuContainer = document.getElementById('menu-container');
const quizScreen = document.getElementById('quiz-screen');
const questionElement = document.getElementById('question');
const answerButtonsElement = document.getElementById('answer-buttons');
const scoreElement = document.getElementById('score');

let currentScore = 0;
let modoSelecionado = 'ambos'; // Guarda a escolha do usuário ('ambos', 'dia1', 'dia2')

// Variáveis para guardar temporariamente as questões
let questaoEnemAtual = null;
let questaoIAAtual = null;

// ==========================================
// FUNÇÕES DE NAVEGAÇÃO DO MENU
// ==========================================
function iniciarQuiz(modo) {
    modoSelecionado = modo;
    menuContainer.style.display = 'none';
    quizScreen.style.display = 'block';
    carregarQuestao();
}

function voltarAoMenu() {
    quizScreen.style.display = 'none';
    menuContainer.style.display = 'block';
    currentScore = 0;
    scoreElement.innerText = currentScore;
}

// ==========================================
// CARREGAR QUESTÃO DO ENEM + IA PREPARATÓRIA
// ==========================================
async function carregarQuestao() {
    questionElement.innerHTML = "Sorteando questão do ENEM...";
    answerButtonsElement.innerHTML = ""; 
    
    // Limpa o canvas se ainda estiver usando ele
    if (typeof limparCanvas === 'function') {
        limparCanvas();
    }

    try {
        const randomYear = Math.floor(Math.random() * 7) + 2014;
        const randomQuestionIndex = Math.floor(Math.random() * 180) + 1;
        
        let url = `https://api.enem.dev/v1/exams/${randomYear}/questions/${randomQuestionIndex}`;
        
        if (randomQuestionIndex <= 5) {
            url += `?language=ingles`;
        }

        const resposta = await fetch(url);
        const data = await resposta.json(); 

        // 1. Trava de segurança para Língua Estrangeira
        if (data.language === 'es' || data.language === 'espanhol') {
            return carregarQuestao(); 
        }

        // 2. Trava de segurança baseada no dia e na disciplina da API
        if (modoSelecionado === 'dia1') {
            if (data.discipline === 'matematica' || data.discipline === 'ciencias-natureza') {
                return carregarQuestao();
            }
        } else if (modoSelecionado === 'dia2') {
            if (data.discipline === 'linguagens' || data.discipline === 'ciencias-humanas') {
                return carregarQuestao();
            }
        }

        // Guardamos a questão oficial do ENEM
        questaoEnemAtual = data;

        // 3. AGORA CHAMAMOS A IA PARA CRIAR O AQUECIMENTO
        questionElement.innerHTML = "🧠 Inteligência Artificial criando um aquecimento para você...";
        
        const imagens = data.files || [];
        
        const respostaIA = await fetch('/api/preparatoria', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contexto: data.context,
                enunciado: data.alternativesIntroduction,
                imagens: imagens
            })
        });

        questaoIAAtual = await respostaIA.json();
        
        // Exibe a questão da IA antes da questão real
        mostrarQuestaoPreparatoria();

    } catch (erro) {
        console.error("Erro ao carregar a questão:", erro);
        questionElement.innerHTML = "Erro ao carregar a questão. Tente recarregar a página.";
    }
}

// ==========================================
// EXIBIR E CONTROLAR A QUESTÃO DA IA (AQUECIMENTO)
// ==========================================
function mostrarQuestaoPreparatoria() {
    let textoCompleto = `<h2 style="color: #6c5ce7; margin-bottom: 15px;">🧠 Aquecimento IA</h2>`;
    textoCompleto += `<p style="background: #f1f2f6; padding: 12px; border-radius: 8px; color: #333;">${questaoIAAtual.texto_preparatorio}</p>`;
    textoCompleto += `<p><strong>${questaoIAAtual.pergunta}</strong></p>`;
    
    questionElement.innerHTML = textoCompleto;
    answerButtonsElement.innerHTML = ""; 
    
    questaoIAAtual.alternativas.forEach((alt, index) => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.innerText = alt;
        
        const estaCorreta = (index === questaoIAAtual.indice_correta);
        
        button.addEventListener('click', (e) => verificarRespostaIA(estaCorreta, e.target));
        
        li.appendChild(button);
        answerButtonsElement.appendChild(li);
    });
}

function verificarRespostaIA(estaCorreta, botaoClicado) {
    const todosOsBotoes = document.querySelectorAll('#answer-buttons button');
    todosOsBotoes.forEach(btn => btn.disabled = true);
    
    if (estaCorreta) {
        botaoClicado.classList.add('btn-correct');
        
        // Cria botão para avançar para a questão oficial do ENEM
        const btnAvancar = document.createElement('button');
        btnAvancar.innerText = "🌟 Muito bem! Clique aqui para encarar a questão do ENEM";
        btnAvancar.style.backgroundColor = "#2d3436";
        btnAvancar.style.color = "white";
        btnAvancar.style.marginTop = "20px";
        btnAvancar.addEventListener('click', () => mostrarQuestao(questaoEnemAtual));
        
        answerButtonsElement.appendChild(btnAvancar);
    } else {
        botaoClicado.classList.add('btn-wrong');
        setTimeout(() => {
             mostrarQuestaoPreparatoria();
        }, 1200);
    }
}

// ==========================================
// FORMATAÇÃO E EXIBIÇÃO DA QUESTÃO REAL DO ENEM
// ==========================================
function formatarMarkdown(texto) {
    if (!texto) return "";
    return texto.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function mostrarQuestao(data) {
    let textoCompleto = `<h2 style="color: #333; margin-bottom: 15px; font-size: 1.2rem;">${data.title}</h2>`;
    
    if (data.context) {
        let contextoFormatado = data.context.replace(
            /!\[.*?\]\((.*?)\)/g, 
            '<img src="$1" class="img-pergunta" style="max-width: 100%; display: block; margin: 15px auto;">'
        );
        let contextoComNegrito = formatarMarkdown(contextoFormatado);
        textoCompleto += `<p>${contextoComNegrito.replace(/\n/g, '<br>')}</p>`;
    }
    
    if (data.alternativesIntroduction) {
        let introComNegrito = formatarMarkdown(data.alternativesIntroduction);
        textoCompleto += `<p><strong>${introComNegrito}</strong></p>`;
    }
    
    questionElement.innerHTML = textoCompleto;

    if (data.files && data.files.length > 0) {
        data.files.forEach(linkDaImagem => {
            if (!textoCompleto.includes(linkDaImagem)) {
                const img = document.createElement('img');
                img.src = linkDaImagem;
                img.classList.add('img-pergunta');
                img.style.maxWidth = "100%"; 
                questionElement.appendChild(img);
            }
        });
    }

    answerButtonsElement.innerHTML = ""; 
    
    data.alternatives.forEach(alternativa => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        
        let textoAlt = formatarMarkdown(alternativa.text || "");
        button.innerHTML = `${alternativa.letter}) ${textoAlt}`;
        
        if (alternativa.file) {
            const imgAlt = document.createElement('img');
            imgAlt.src = alternativa.file;
            imgAlt.style.maxWidth = "100%";
            button.appendChild(document.createElement('br')); 
            button.appendChild(imgAlt);
        }

        button.addEventListener('click', (e) => verificarRespostaEnem(alternativa.isCorrect, e.target));

        li.appendChild(button);
        answerButtonsElement.appendChild(li);
    });
}

function verificarRespostaEnem(estaCorreta, botaoClicado) {
    if (estaCorreta) {
        currentScore++; 
        botaoClicado.classList.add('btn-correct');
    } else {
        currentScore = 0; 
        botaoClicado.classList.add('btn-wrong');
    }
    
    scoreElement.innerText = currentScore;
    
    const todosOsBotoes = document.querySelectorAll('#answer-buttons button');
    todosOsBotoes.forEach(btn => btn.disabled = true);
    
    setTimeout(() => {
        carregarQuestao(); 
    }, 800);
}
// Função para transformar **texto** em <strong>texto</strong> de forma segura
function formatarMarkdown(texto) {
    if (!texto) return "";
    // Substitui o primeiro ** por <strong> e o segundo ** por </strong>
    return texto.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

// ==========================================
// LÓGICA DO CANVAS (RASCUNHO)
// ==========================================
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
let desenhando = false;

// Estilo do traço
ctx.strokeStyle = '#1e293b';
ctx.lineWidth = 2.5;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// Eventos de Mouse (Computador)
canvas.addEventListener('mousedown', (e) => {
    desenhando = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
});

canvas.addEventListener('mousemove', (e) => {
    if (!desenhando) return;
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
});

canvas.addEventListener('mouseup', () => desenhando = false);
canvas.addEventListener('mouseout', () => desenhando = false);

// Eventos de Toque (Celular / Tablet)
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Evita que a tela role junto
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    desenhando = true;
    ctx.beginPath();
    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!desenhando) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
    ctx.stroke();
});

canvas.addEventListener('touchend', () => desenhando = false);

// Botão manual para limpar o rascunho
document.getElementById('clear-canvas').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Função auxiliar para limpar o canvas automaticamente a cada questão nova
function limparCanvas() {
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}