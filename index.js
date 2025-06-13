const express = require('express');
const axios = require('axios');
const app = express();
const port = 8546;

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

  try {
    const response = await axios.post(WAVES_NODE, req.body, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (
      method === 'eth_sendRawTransaction' &&
      response.data.error &&
      response.data.error.code === -32000
    ) {
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

if (
  method === 'eth_sendRawTransaction' &&
  response.data.error
) {
  // Retorna que a transação foi cancelada ao invés do erro original
  return res.status(200).json({
    jsonrpc: '2.0',
    id,
    result: null,
    error: {
      code: 4001, // código customizado para "transação cancelada"
      message: 'Transação cancelada pelo proxy.',
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
