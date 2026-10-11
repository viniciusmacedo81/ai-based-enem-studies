import { GoogleGenAI } from '@google/genai';

// Mesma chave do arquivo .env usada em api/preparatoria.js
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Modelos tentados em ordem, como em preparatoria.js
const MODELOS = ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-3.8-pro'];

// Só baixamos imagens do próprio domínio do ENEM (evita que a rota seja usada para buscar qualquer URL)
function imagemPermitida(url) {
    try {
        const { protocol, hostname } = new URL(url);
        return protocol === 'https:' && (hostname === 'enem.dev' || hostname.endsWith('.enem.dev'));
    } catch (e) {
        return false;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Só aceita POST');

    // Se o navegador desistir (Cancelar), paramos de gastar modelos do Gemini
    let cancelado = false;
    res.on('close', () => { if (!res.writableEnded) cancelado = true; });

    try {
        const { contexto, enunciado, alternativas, gabarito, imagens } = req.body || {};

        if (!Array.isArray(alternativas) || alternativas.length === 0) {
            return res.status(400).json({ error: 'Faltam as alternativas da questão.' });
        }

        const partes = [];

        // Na run o aluno já vê as imagens, então a IA também pode olhar para elas
        const urls = (Array.isArray(imagens) ? imagens : []).filter(imagemPermitida).slice(0, 3);
        for (const url of urls) {
            try {
                const resposta = await fetch(url);
                const buffer = Buffer.from(await resposta.arrayBuffer());
                partes.push({
                    inlineData: {
                        data: buffer.toString('base64'),
                        mimeType: resposta.headers.get('content-type') || 'image/jpeg'
                    }
                });
            } catch (imgErro) {
                console.log('Aviso: falha ao carregar uma imagem para a dica.', imgErro);
            }
        }

        const listaAlternativas = alternativas
            .map(a => `${a.letra}) ${a.texto || '(alternativa em imagem)'}`)
            .join('\n');

        const prompt = `
            Você é um professor de ENEM ajudando um aluno que está no meio de uma partida de estudo.
            Contexto: ${contexto || 'Nenhum'}
            Enunciado: ${enunciado || 'Nenhum'}
            Alternativas:
            ${listaAlternativas}

            Gabarito (SOMENTE para você se orientar, nunca revele): ${gabarito || 'desconhecido'}

            Escreva UMA dica curta, em português do Brasil, com no máximo 2 frases.
            A dica deve apontar o conceito, o caminho de raciocínio ou o detalhe do texto que o aluno precisa observar.

            REGRAS:
            - NÃO diga qual é a alternativa correta, nem cite a letra dela, nem copie o texto dela.
            - NÃO elimine alternativas citando letras.
            - NÃO use emojis, markdown, listas nem aspas.
            - Retorne APENAS o texto da dica, sem introdução.
        `;
        partes.push(prompt);

        let resposta = null;
        for (const modelo of MODELOS) {
            if (cancelado) break;
            try {
                resposta = await ai.models.generateContent({ model: modelo, contents: partes });
                break;
            } catch (erroDemanda) {
                console.log(`Modelo ${modelo} falhou ou está ocupado. Tentando o próximo...`);
            }
        }

        if (cancelado) return;

        if (!resposta) {
            return res.status(503).json({ error: 'Nenhum modelo do Gemini respondeu à requisição.' });
        }

        // Limpa qualquer formatação que a IA tenha usado mesmo assim
        const dica = (resposta.text || '')
            .replace(/[`*_#>]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 400);

        if (!dica) {
            return res.status(502).json({ error: 'A IA devolveu uma resposta vazia.' });
        }

        return res.status(200).json({ dica });

    } catch (error) {
        console.error('Erro ao gerar a dica:', error);
        return res.status(500).json({ error: 'Erro ao gerar a dica com IA.' });
    }
}
