const express = require('express');
const axios = require('axios');
const app = express();
const port = 8547;

const WAVES_NODE = 'https://nodes.gscscan.com/eth';

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  next();
});

app.post('/', async (req, res) => {
  const { method, id, params } = req.body;

  // Log completo da requisição para debug
  console.log('--- Nova requisição RPC ---');
  console.log('Method:', method);
  console.log('ID:', id);
  console.log('Params:', JSON.stringify(params, null, 2));
  console.log('Body completo:', JSON.stringify(req.body, null, 2));
  console.log('--------------------------');

  if (method === 'web3_clientVersion') {
    return res.json({
      jsonrpc: '2.0',
      id,
      result: 'ProxyNode/eth-compatible/v1.0.0',
    });
  }

  if (method === 'net_version' || method === 'eth_chainId') {
    return res.json({
      jsonrpc: '2.0',
      id,
      result: '0x47',
    });
  }

  if (method === 'eth_estimateGas') {
    return res.json({
      jsonrpc: '2.0',
      id,
      result: '0x7a120',
    });
  }

  //return 10 gwei como preço de gás
  if (method === 'eth_gasPrice') {
    return res.json({
      jsonrpc: '2.0',
      id,
      result: '0x2540be400', // 10 Gwei em hexadecimal
    });
  }

  // se for eth_sendRawTransaction altera para ter 10 gwei se tiver menos ou mais que 10 gwei e envia novamente para o node a solicitação da transação e retorna para o usuário 
  if (method === 'eth_sendRawTransaction' && params && params[0]) {
    const rawTx = params[0];
    const gasPrice = parseInt(rawTx.gasPrice, 16);

    // Verifica se o preço do gás é diferente de 10 Gwei
    if (gasPrice !== 10000000000) { // 10 Gwei em wei
      console.log('Ajustando gasPrice para 10 Gwei');
      rawTx.gasPrice = '0x2540be400'; // 10 Gwei em hexadecimal
      params[0] = rawTx; // Atualiza o parâmetro com o novo gasPrice
    }
  }



  if(method === 'eth_sendRawTransaction' && !params) {
    return res.status(400).json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32602,
        message: 'Parâmetros inválidos: params é obrigatório para eth_sendRawTransaction',
      },
    });
  }

  /*lidando com o seguinte erro:
  Method: eth_getTransactionReceipt
ID: 103915128277693
Params: [
  {
    "error": 199,
    "message": "Gas price must be 10 Gwei"
  }
]
Body completo: {
  "id": 103915128277693,
  "jsonrpc": "2.0",
  "method": "eth_getTransactionReceipt",
  "params": [
    {
      "error": 199,
      "message": "Gas price must be 10 Gwei"
    }
  ]
}
  
significa que o gwei estava abaixo de 10 e a transação precisa aparecer como cancelada*/
  if (method === 'eth_getTransactionReceipt' && params && params[0] && params[0].error) {
    const error = params[0].error;
    if (error === 199) {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          status: '0x0', // Transação falhou
          error: {
            code: -32000,
            message: 'Gas price must be 10 Gwei',
          },
        },
      });
    }
    return res.json({
      jsonrpc: '2.0',
      id,
      result: {
        status: '0x1', // Transação bem-sucedida
      },
    });
  }


  if(method === 'eth_sendRawTransaction') {
    try{
      const response = await axios.post(WAVES_NODE, {
        jsonrpc: '2.0',
        id,
        method,
        params: [params[0]], // Envia apenas o primeiro parâmetro
      }, {
        headers: { 'Content-Type': 'application/json' },
      });
      return res.json(response.data);
    }catch(e){
      console.error('Erro ao enviar transação:', e.message);
      return res.status(500).json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32000,
          message: 'Erro ao enviar transação: ' + e.message,
        },
      });
    }
  }

  try {
    const response = await axios.post(WAVES_NODE, req.body, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (
      method === 'eth_sendRawTransaction' &&
      response.data.error &&
      response.data.error.code === -32000
    ) {
      console.log("Data:",data.response)
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32000,
          message:
            'ProxyNode: envio de transação não suportado ou falhou no backend Waves',
        },
      });
    }



    res.json(response.data);
  } catch (err) {
    console.error('Erro no proxy:', err.message);
    res.status(500).json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32000,
        message: 'Proxy error: ' + err.message,
      },
    });
  }
});

app.listen(port, () => {
  console.log(`Proxy RPC rodando em http://localhost:${port}`);
});
