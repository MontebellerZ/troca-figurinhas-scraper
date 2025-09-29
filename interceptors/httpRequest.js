function formatBody(body, contentType) {
  if (!body) return console.log('(sem corpo)');

  if (typeof body === 'string') {
    // JSON
    if (contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(body);
        console.log('Body (JSON formatado):', parsed);
      } catch {
        console.log('Body (JSON inválido, mostrando texto):', body);
      }
      return;
    }

    // x-www-form-urlencoded
    if (contentType.includes('application/x-www-form-urlencoded')) {
      console.log('Body (form-urlencoded):');
      const params = new URLSearchParams(body);
      for (const [key, value] of params.entries()) {
        console.log(`  ${key}: ${value}`);
      }
      return;
    }

    // Qualquer outro texto
    console.log('Body (texto):', body);
    return;
  }

  // FormData
  if (body instanceof FormData) {
    console.log('Body (FormData):');
    for (const [key, value] of body.entries()) {
      console.log(`  ${key}:`, value);
    }
    return;
  }

  // ArrayBuffer, Blob, etc
  if (body instanceof Blob) {
    console.log(`Body (Blob): tipo=${body.type || '(desconhecido)'} tamanho=${body.size} bytes`);
    return;
  }

  console.log('Body (tipo desconhecido):', body);
}

// Intercepta XMLHttpRequest
(function() {
  const OriginalXHR = window.XMLHttpRequest;

  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();

    let method = '';
    let url = '';
    let body = null;
    let headers = {};

    const originalOpen = xhr.open;
    xhr.open = function(m, u) {
      method = m;
      url = u;
      return originalOpen.apply(xhr, arguments);
    };

    const originalSetRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = function(header, value) {
      headers[header.toLowerCase()] = value;
      return originalSetRequestHeader.apply(xhr, arguments);
    };

    const originalSend = xhr.send;
    xhr.send = function(data) {
      body = data;
      const contentType = headers['content-type'] || '';

      console.log('%c[Interceptado XHR]', 'color: orange; font-weight: bold;');
      console.log('Método:', method);
      console.log('URL:', url);
      console.log('Content-Type:', contentType || '(não definido)');
      formatBody(body, contentType);

      // NÃO envia a requisição
      return;
    };

    return xhr;
  };
})();

// Intercepta fetch
(function() {
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    const method = (init && init.method) || 'GET';
    const body = init && init.body;

    let headers = (init && init.headers) || {};
    if (headers instanceof Headers) {
      const h = {};
      headers.forEach((v, k) => h[k.toLowerCase()] = v);
      headers = h;
    }

    const contentType = headers['content-type'] || '';

    console.log('%c[Interceptado Fetch]', 'color: cyan; font-weight: bold;');
    console.log('Método:', method);
    console.log('URL:', input);
    console.log('Content-Type:', contentType || '(não definido)');
    formatBody(body, contentType);

    // NÃO envia a requisição
    return new Promise(() => {});
  };
})();
