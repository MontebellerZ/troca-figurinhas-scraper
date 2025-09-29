(function () {
  if (typeof window.__doPostBack === "function") {
    const originalPostBack = window.__doPostBack;

    window.__doPostBack = function (eventTarget, eventArgument) {
      console.log("%c[Interceptado __doPostBack]", "color: purple; font-weight: bold;");
      console.log("Evento:", eventTarget);
      console.log("Argumento:", eventArgument);

      const form = document.forms[0];
      if (form) {
        const action = form.getAttribute("action");
        const endpoint = action && action.trim() !== "" 
          ? new URL(action, window.location.origin).href 
          : window.location.href;

        console.log("Endpoint do POST:", endpoint);

        const data = new FormData(form);
        const params = new URLSearchParams();

        for (const [key, value] of data.entries()) {
          params.append(key, value);
          console.log(`  ${key}: ${value}`);
        }

        // Gera o cURL
        const curl = [
          `curl '${endpoint}'`,
          "-X POST",
          "-H 'Content-Type: application/x-www-form-urlencoded'",
          `--data-raw '${params.toString()}'`
        ].join(" \\\n");

        console.log("%c[CURL para reproduzir requisição]", "color: orange; font-weight: bold;");
        console.log(curl);
      }

      // Bloqueia o envio real (descomente para permitir navegação normal)
      // return originalPostBack.apply(this, arguments);
    };

    console.log("%cInterceptação de __doPostBack habilitada! (Com geração de cURL)", "color: green; font-weight: bold;");
  } else {
    console.warn("[Aviso] __doPostBack não está definido nesta página.");
  }
})();
