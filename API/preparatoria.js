import { GoogleGenAI } from '@google/genai';

// Inicia a conexão com o Gemini usando a chave do seu arquivo .env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
    // Garante que só o seu script.js (via POST) acesse essa rota
    if (req.method !== 'POST') return res.status(405).send('Só aceita POST');

    try {
        const { contexto, enunciado, imagens } = req.body;
        let partes = [];
        
        // Se houver imagens na questão, baixamos e preparamos para o Gemini enxergar
        if (imagens && imagens.length > 0) {
            for (const url of imagens) {
                try {
                    const response = await fetch(url);
                    const arrayBuffer = await response.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    
                    partes.push({
                        inlineData: {
                            data: buffer.toString("base64"),
                            mimeType: response.headers.get("content-type") || "image/jpeg"
                        }
                    });
                } catch (imgErro) {
                    console.log("Aviso: Falha ao carregar uma imagem para a IA.", imgErro);
                }
            }
        }

        // Criando o comando restrito para a IA devolver APENAS o JSON
       // Criando o comando com restrição visual
        const prompt = `
            Você é um professor didático.
            Leia o contexto e o enunciado desta questão do ENEM:
            Contexto: ${contexto || 'Nenhum'}
            Enunciado: ${enunciado || 'Nenhum'}
            
            Analise o conceito principal cobrado nesta questão e crie uma "Questão Preparatória" BEM MAIS FÁCIL para aquecer a mente do aluno.
            
            REGRA DE OURO (MUITO IMPORTANTE): O aluno AINDA NÃO PODE VER as imagens da questão durante o aquecimento. Portanto, NUNCA faça referências visuais como "na imagem abaixo", "no canto esquerdo" ou "como podemos ver no gráfico". Crie uma questão puramente teórica e autossuficiente que aborde o mesmo conceito da imagem, mas sem depender dela visualmente.
            
            NÃO use emojis em nenhum campo do texto.
            
            IMPORTANTE: Retorne APENAS um objeto JSON válido. Não use blocos de código (\`\`\`json) e não escreva nenhum texto antes ou depois. Use EXATAMENTE este formato:
            {
                "texto_preparatorio": "Breve explicação do conceito de forma simples (max 3 linhas).",
                "pergunta": "A pergunta de aquecimento.",
                "alternativas": ["A) opção", "B) opção", "C) opção", "D) opção"],
                "indice_correta": 0,
                "explicacao_acerto": "Parabéns! Você acertou porque..."
            }
        `;
        partes.push(prompt);

        // Lista otimizada com os modelos da geração 3.8
        const modelos = ['gemini-3.6-flash' ,'gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-3.8-pro'];
        let response = null;

        for (const nomeModelo of modelos) {
            try {
                response = await ai.models.generateContent({
                    model: nomeModelo,
                    contents: partes,
                });
                console.log(`✅ Sucesso! Aquecimento gerado pelo: ${nomeModelo}`);
                break; 
            } catch (erroDemanda) {
                // Log limpo e curto, sem cuspir aquele JSON gigante de erro no terminal
                console.log(`⚠️ Modelo ${nomeModelo} falhou ou está ocupado. Tentando o próximo...`);
            }
        }

        if (!response) {
            return res.status(503).json({ error: 'Nenhum modelo do Gemini respondeu à requisição.' });
        }

        // Limpa a resposta de qualquer sujeira (como formatação markdown) antes de transformar em JSON
        let respostaJSONTexto = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonFinal = JSON.parse(respostaJSONTexto);

        // Devolve a questão pronta pro seu site!
        return res.status(200).json(jsonFinal);

    } catch (error) {
        console.error('Erro na API do Gemini:', error);
        return res.status(500).json({ error: 'Erro ao gerar questão com IA.' });
    }
}