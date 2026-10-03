import { GoogleGenAI } from '@google/genai';

// A Vercel vai puxar a chave automaticamente do seu .env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Só aceita POST');

    try {
        // Recebe os dados da questão do ENEM que o script.js vai enviar
        const { contexto, enunciado, imagens } = req.body;

        // O Gemini precisa que imagens da web sejam baixadas e convertidas para base64
        let partes = [];
        
        // Se a questão tiver imagens, baixamos e preparamos para o Gemini ver
        if (imagens && imagens.length > 0) {
            for (const url of imagens) {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                
                partes.push({
                    inlineData: {
                        data: buffer.toString("base64"),
                        mimeType: response.headers.get("content-type") || "image/jpeg"
                    }
                });
            }
        }

        // Criando o comando (Prompt) perfeito para o Gemini
        const prompt = `
            Você é um professor didático.
            Leia o contexto e o enunciado desta questão do ENEM:
            Contexto: ${contexto || 'Nenhum'}
            Enunciado: ${enunciado || 'Nenhum'}
            
            Analise o conceito principal cobrado nesta questão (seja uma fórmula, regra de gramática, ou interpretação de texto) e crie uma "Questão Preparatória" BEM MAIS FÁCIL para aquecer a mente do aluno.
            
            Retorne APENAS um objeto JSON válido, com a seguinte estrutura:
            {
                "texto_preparatorio": "Um breve texto explicando o conceito de forma simples (max 3 linhas).",
                "pergunta": "A pergunta de aquecimento.",
                "alternativas": ["A) ...", "B) ...", "C) ...", "D) ..."],
                "indice_correta": 0, // número de 0 a 3, indicando qual alternativa no array está certa
                "explicacao_acerto": "Uma frase de parabéns explicando por que está certo."
            }
        `;
        partes.push(prompt);

        // Chama o Gemini (Usando o modelo flash, que é rápido e processa texto e imagem)
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: partes,
        });

        // Limpa a resposta para garantir que seja um JSON válido e envia de volta
        let respostaJSON = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        return res.status(200).json(JSON.parse(respostaJSON));

    } catch (error) {
        console.error('Erro na API do Gemini:', error);
        return res.status(500).json({ error: 'Erro ao gerar questão com IA.' });
    }
}