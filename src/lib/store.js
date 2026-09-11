/**
 * Estado observável mínimo.
 *
 * O protótipo dependia do setState do React. Aqui o papel é o mesmo, em ~60
 * linhas: guardar estado, notificar quem se inscreveu e nada mais.
 */

/**
 * @template T
 * @param {T} inicial
 */
export function criarStore(inicial = {}) {
  let estado = { ...inicial };
  const inscritos = new Set();

  function notificar(anterior) {
    for (const fn of inscritos) fn(estado, anterior);
  }

  return {
    /** @returns {T} */
    get estado() {
      return estado;
    },

    get(chave) {
      return estado[chave];
    },

    /** Mescla e notifica. Aceita objeto ou função (estadoAtual) => patch. */
    set(patch) {
      const anterior = estado;
      const delta = typeof patch === 'function' ? patch(estado) : patch;
      estado = { ...estado, ...delta };
      notificar(anterior);
      return estado;
    },

    /**
     * Mescla SEM notificar.
     *
     * Existe por causa dos campos de texto: re-renderizar a cada tecla faria o
     * input perder o foco e a posição do cursor. O valor digitado já está no
     * DOM — o store só precisa acompanhar, e a tela é redesenhada no próximo
     * evento que realmente mude a estrutura.
     */
    setSilencioso(patch) {
      const delta = typeof patch === 'function' ? patch(estado) : patch;
      estado = { ...estado, ...delta };
      return estado;
    },

    /** @returns {() => void} cancela a inscrição */
    inscrever(fn) {
      inscritos.add(fn);
      return () => inscritos.delete(fn);
    },

    /** Inscrição que só dispara quando `seletor(estado)` muda. */
    inscreverEm(seletor, fn) {
      let anterior = seletor(estado);
      return this.inscrever((novo) => {
        const atual = seletor(novo);
        if (!Object.is(atual, anterior)) {
          const velho = anterior;
          anterior = atual;
          fn(atual, velho);
        }
      });
    },

    reset(novo = inicial) {
      const anterior = estado;
      estado = { ...novo };
      notificar(anterior);
    },
  };
}
