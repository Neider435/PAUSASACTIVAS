const fetch = require('node-fetch');

// Configuración desde variables de entorno
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'Neider435';
const GITHUB_REPO = process.env.GITHUB_REPO || 'PAUSASACTIVAS';

exports.handler = async (event, context) => {
  // Solo permitir método POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { method, path, body } = JSON.parse(event.body);
    
    // Validar parámetros
    if (!method || !path) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing method or path' })
      };
    }

    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${path}`;
    
    const headers = {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PausasActivas-Inlotrans-Netlify',
      'Content-Type': 'application/json'
    };

    let response;

    if (method === 'GET') {
      // Obtener archivo
      response = await fetch(url, { headers });
      
      if (!response.ok) {
        return {
          statusCode: response.status,
          body: JSON.stringify({ error: await response.text() })
        };
      }
      
      const data = await response.json();
      
      // Decodificar contenido base64
      const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          content,
          sha: data.sha 
        })
      };
    }
    
    if (method === 'PUT') {
      // Actualizar archivo
      const { content, sha, message } = body;
      
      if (!content || !sha) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing content or sha' })
        };
      }

      response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: message || `Update ${path} via Netlify Function`,
          content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
          sha
        })
      });
      
      if (!response.ok) {
        return {
          statusCode: response.status,
          body: JSON.stringify({ error: await response.text() })
        };
      }
      
      const result = await response.json();
      
      return {
        statusCode: 200,
        body: JSON.stringify(result)
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid method' })
    };

  } catch (error) {
    console.error('Error in github-proxy:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};