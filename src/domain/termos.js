/**
 * Textos dos termos apresentados ao paciente.
 *
 * Ficam aqui, e não espalhados pelas telas, porque é o mesmo texto que aparece
 * na ficha de anamnese e no momento de anexar a primeira foto. Divergir entre
 * os dois seria colher autorização para uma coisa e registrar outra.
 *
 * Fonte: termo da ficha em papel
 * (docs/referencias/ficha-anamnese-original.pdf).
 */

/** Item 1 — veracidade das informações prestadas. */
export const TERMO_VERACIDADE =
  '1. Declaro que as informações acima são verdadeiras, que nada omiti em relação à minha saúde ou reações alérgicas e que informei todos os medicamentos que eventualmente estou utilizando, não cabendo ao profissional quaisquer responsabilidades por informações omitidas nesta entrevista.';

/** Item 2 — ciência dos procedimentos. */
export const TERMO_PROCEDIMENTOS =
  '2. Declaro que estou ciente sobre os procedimentos a serem realizados e me comprometo em seguir todos os cuidados passados a fim de obter o melhor resultado no tratamento.';

/** Item 3 — autorização de uso de imagem. */
export const TERMO_IMAGEM =
  '3. Autorizo o registro fotográfico do trabalho realizado (“antes” e “depois”) para efeitos de documentação, divulgação em redes sociais, books ou qualquer material publicitário. A presente autorização é concedida gratuitamente, sem que nada a ser reclamado a título de direitos ou quaisquer outro.';

/** Os três, na ordem da ficha. Usado pela etapa "Termo e autorização". */
export const TERMO_COMPLETO = [TERMO_VERACIDADE, TERMO_PROCEDIMENTOS, TERMO_IMAGEM];

/**
 * Aviso exibido ao colher só a autorização de imagem, fora da anamnese.
 *
 * O consentimento para uso de imagem é revogável a qualquer tempo (LGPD
 * art. 8º, §5º) e precisa ser informado — por isso o texto do termo é
 * apresentado na hora, não apenas uma caixa de seleção.
 */
export const AVISO_IMAGEM =
  'Leia o termo acima com o paciente antes de colher a assinatura. ' +
  'A autorização pode ser revogada depois, a qualquer momento, pela tela de cadastro.';
