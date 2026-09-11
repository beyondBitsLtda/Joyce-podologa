/**
 * Tabelas de apoio para os seletores de endereço e profissão.
 *
 * Extraído sem alteração do protótipo (prototype/index.html, locData()).
 *
 * Limitação conhecida: as listas de cidade/bairro/rua são parciais — cobrem a
 * região de atendimento (Grande BH) e as capitais. O seletor sempre oferece
 * "Usar <texto digitado>", então nada bloqueia o cadastro fora da lista.
 * Para cobertura nacional, o caminho é trocar `cidades` pela API do IBGE e
 * `bairros`/`ruas` por consulta de CEP (ViaCEP) — ver docs/ARQUITETURA.md.
 */
export const LOCALIDADES = {
  ufs: ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'],
  cidades: {
  AC: ['Rio Branco', 'Cruzeiro do Sul'], AL: ['Maceió', 'Arapiraca'], AM: ['Manaus', 'Parintins'],
  AP: ['Macapá', 'Santana'], BA: ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Ilhéus'],
  CE: ['Fortaleza', 'Caucaia', 'Sobral', 'Juazeiro do Norte'], DF: ['Brasília', 'Ceilândia', 'Gama', 'Sobradinho'],
  ES: ['Vitória', 'Vila Velha', 'Serra', 'Cariacica'], GO: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde'],
  MA: ['São Luís', 'Imperatriz', 'Timon', 'Caxias'],
  MG: ['Belo Horizonte', 'Vespasiano', 'Santa Luzia', 'Ribeirão das Neves', 'Contagem', 'Betim', 'Nova Lima', 'Sabará', 'Lagoa Santa', 'Confins', 'São José da Lapa', 'Pedro Leopoldo', 'Ibirité', 'Sete Lagoas', 'Uberlândia', 'Uberaba', 'Juiz de Fora', 'Montes Claros', 'Divinópolis', 'Governador Valadares', 'Ipatinga', 'Poços de Caldas', 'Patos de Minas', 'Barbacena', 'Varginha', 'Itabira', 'Araxá', 'Passos', 'Teófilo Otoni', 'Conselheiro Lafaiete', 'Ouro Preto', 'Mariana', 'Itaúna', 'São João del-Rei', 'Alfenas', 'Curvelo', 'Lavras', 'Muriaé', 'Ubá', 'Formiga'],
  MS: ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá'],
  MT: ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop'],
  PA: ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Castanhal'],
  PB: ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos'],
  PE: ['Recife', 'Olinda', 'Jaboatão dos Guararapes', 'Caruaru', 'Petrolina', 'Paulista'],
  PI: ['Teresina', 'Parnaíba', 'Picos'],
  PR: ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'São José dos Pinhais', 'Foz do Iguaçu', 'Colombo'],
  RJ: ['Rio de Janeiro', 'Niterói', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Petrópolis', 'Volta Redonda', 'Campos dos Goytacazes', 'Macaé', 'Belford Roxo'],
  RN: ['Natal', 'Mossoró', 'Parnamirim'], RO: ['Porto Velho', 'Ji-Paraná', 'Vilhena'], RR: ['Boa Vista'],
  RS: ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Canoas', 'Santa Maria', 'Novo Hamburgo', 'Gravataí', 'São Leopoldo', 'Passo Fundo'],
  SC: ['Florianópolis', 'Joinville', 'Blumenau', 'Chapecó', 'Criciúma', 'São José', 'Itajaí', 'Balneário Camboriú', 'Palhoça'],
  SE: ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto'],
  SP: ['São Paulo', 'Campinas', 'Guarulhos', 'Santo André', 'São Bernardo do Campo', 'São Caetano do Sul', 'Ribeirão Preto', 'Sorocaba', 'Santos', 'Osasco', 'Diadema', 'Mauá', 'Jundiaí', 'Piracicaba', 'Bauru', 'São José do Rio Preto', 'São José dos Campos', 'Mogi das Cruzes', 'Limeira', 'Franca', 'Taubaté', 'Praia Grande'],
  TO: ['Palmas', 'Araguaína', 'Gurupi']
  },
  bairros: {
  'Vespasiano': ['Centro', 'Morro Alto', 'Jardim Itaú', 'Nova Pampulha', 'Caieiras', 'Santa Clara', 'Vila Esportiva', 'Angicos', 'Serra Dourada', 'Bela Vista'],
  'Santa Luzia': ['Centro', 'São Benedito', 'Palmital', 'Frimisa', 'Cristina'],
  'Contagem': ['Eldorado', 'Centro', 'Industrial', 'Riacho das Pedras', 'Ressaca'],
  'Lagoa Santa': ['Centro', 'Lundcéia', 'Palmital', 'Várzea'],
  'Belo Horizonte': ['Savassi', 'Funcionários', 'Pampulha', 'Centro', 'Barro Preto', 'Santa Efigênia'],
  'São Paulo': ['Bela Vista', 'Pinheiros', 'Vila Mariana', 'Moema', 'Tatuapé', 'Santana', 'Itaim Bibi', 'Mooca', 'Lapa'],
  'Campinas': ['Cambuí', 'Barão Geraldo', 'Taquaral', 'Centro', 'Jardim Guanabara'],
  'Rio de Janeiro': ['Copacabana', 'Botafogo', 'Tijuca', 'Ipanema', 'Barra da Tijuca', 'Méier'],
  'Curitiba': ['Batel', 'Água Verde', 'Centro', 'Portão', 'Bigorrilho'],
  'Porto Alegre': ['Moinhos de Vento', 'Cidade Baixa', 'Centro Histórico', 'Petrópolis', 'Menino Deus'],
  'Florianópolis': ['Centro', 'Trindade', 'Lagoa da Conceição', 'Campeche'],
  'Salvador': ['Barra', 'Pituba', 'Rio Vermelho', 'Itaigara', 'Campo Grande'],
  'Goiânia': ['Setor Bueno', 'Setor Oeste', 'Setor Marista', 'Jardim Goiás'],
  'Divinópolis': ['Centro', 'Santo Antônio', 'Niterói', 'São José']
  },
  ruas: {
  'Centro': ['Av. Prefeito Sebastião Fernandes', 'Rua Antônio Carlos', 'Rua Rio Branco'],
  'Morro Alto': ['Av. Vereador Nelson Rocha', 'Rua Salvador', 'Rua Bahia'],
  'Jardim Itaú': ['Rua Itaú', 'Rua das Palmeiras', 'Rua Ipê'],
  'Bela Vista': ['Rua Augusta', 'Av. Paulista', 'Rua Frei Caneca'],
  'Pinheiros': ['Rua dos Pinheiros', 'Rua Teodoro Sampaio', 'Rua Cardeal Arcoverde'],
  'Savassi': ['Rua Pernambuco', 'Rua Antônio de Albuquerque', 'Rua Alagoas'],
  'Batel': ['Av. do Batel', 'Rua Bispo Dom José', 'Rua Comendador Araújo'],
  'Copacabana': ['Av. Atlântica', 'Rua Barata Ribeiro', 'Rua Nossa Senhora de Copacabana'],
  'Cambuí': ['Rua Coronel Quirino', 'Av. Júlio de Mesquita', 'Rua Delfino Cintra']
  },
  bairrosPadrao: ['Centro', 'Jardim América', 'Jardim Europa', 'Santa Rita', 'São José', 'Vila Nova', 'Boa Vista'],
  ruasPadrao: ['Av. Brasil', 'Av. Getúlio Vargas', 'Av. Presidente Vargas', 'Rua das Flores', 'Rua Dom Pedro II', 'Rua João Pessoa', 'Rua José Bonifácio', 'Rua Minas Gerais', 'Rua Sete de Setembro', 'Rua Quinze de Novembro', 'Rua Santos Dumont', 'Rua São Paulo', 'Rua Tiradentes', 'Travessa São João'],
  profissoes: ['Aposentada', 'Autônoma', 'Comerciante', 'Do lar', 'Enfermeira', 'Estudante', 'Motorista', 'Professora', 'Servidora pública', 'Vendedora']
};

/**
 * Opções de um seletor, considerando as dependências já preenchidas.
 * Espelha optionsFor() do protótipo.
 *
 * @param {string} source  'uf' | 'prof' | 'cidade' | 'bairro' | 'rua'
 * @param {object} form    respostas atuais (estado, cidade, bairro)
 * @returns {string[]}
 */
export function opcoesDe(source, form = {}) {
  const L = LOCALIDADES;

  switch (source) {
    case 'uf':
      return L.ufs;

    case 'prof':
      return L.profissoes;

    case 'cidade':
      return form.estado ? L.cidades[form.estado] || [] : [];

    case 'bairro':
      return form.cidade ? L.bairros[form.cidade] || L.bairrosPadrao : [];

    case 'rua': {
      if (!form.cidade) return [];
      // Ruas do bairro primeiro; depois os logradouros genéricos que ainda não
      // apareceram, para a lista nunca ficar vazia num bairro desconhecido.
      const doBairro = L.ruas[form.bairro] || [];
      return doBairro.concat(L.ruasPadrao.filter((r) => !doBairro.includes(r)));
    }

    default:
      return [];
  }
}
