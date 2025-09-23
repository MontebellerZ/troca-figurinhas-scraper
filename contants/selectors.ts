export const SELECTORS = {
  restricao: "#ctl00_upRestricao",

  login: {
    nick: "#ctl00_lvUser_ucNL_txtLogin",
    senha: "#ctl00_lvUser_ucNL_txtSenha",
    submit: "#ctl00_lvUser_ucNL_btnLogin",
  },

  listaColecionadores: {
    filtro: {
      aba: "#ctl00_CPH_ucFiltrar_AccordionPane1_header > div.Filtro",
      select: "#ctl00_CPH_ucFiltrar_AccordionPane1_content_ddlAlbuns_ColecionadoresBusca",
      submit: "#ctl00_CPH_ucFiltrar_AccordionPane1_content_Button4",
    },

    tabela: {
      selector: "#ctl00_CPH_gvColecionadores",

      colecionador: {
        selector: "div.PerfilListas-Content:has(a.PerfilListas-Figurinhas)",
        nick: "span.LoginPerfil",
        nick2: "span.LoginPerfilPeq",
        perfil: ".PerfilListas-Content-Avatar > a",
        figurinhas: "a.PerfilListas-Figurinhas",
        presenca: ".Presenca > div",
      },

      paginacao: {
        proxima: "tr.gvPagerPadrao td:has(span) + td > a",
      },
    },
  },

  colecionador: {
    albuns: {
      trocarAlbum:
        "#ctl00_CPH_uc_AlbunsDoUsuario_tcAlbum_tpAlbumSelecionado > div > div.Album-Selecao-TrocarAlbum > a",
      selectIncompletos: "#ctl00_CPH_uc_AlbunsDoUsuario_tcAlbum_tpTrocar_ddlAlbunsIncompletos",
      selectCompletos: "#ctl00_CPH_uc_AlbunsDoUsuario_tcAlbum_tpTrocar_ddlAlbunsCompletos",
      submitIncompletos:
        "#ctl00_CPH_uc_AlbunsDoUsuario_tcAlbum_tpTrocar_imgSelecionarAlbumIncompleto",
      submitCompletos: "#ctl00_CPH_uc_AlbunsDoUsuario_tcAlbum_tpTrocar_imgSelecionarAlbumCompleto",
    },

    cruzamento: {
      aba: "#__tab_ctl00_CPH_tabcFigurinhas_tabpCruzamento",

      figurinhas: {
        tem: "#ctl00_CPH_tabcFigurinhas_tabpCruzamento_lblConteudoAEnviar",
        falta: "#ctl00_CPH_tabcFigurinhas_tabpCruzamento_lblConteudoAReceber",
      },
    },
  },
} as const;
